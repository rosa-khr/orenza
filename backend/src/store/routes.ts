import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { toPublicRecord } from "../admin/repository.js";
import { getPublicSiteSettings, getSiteSettings } from "../site-settings.js";
import { OrderService } from "./order-service.js";
import { removePaymentReceipt, savePaymentReceipt } from "../payment-receipts.js";
import { openProductImage } from "../product-images.js";
import { openHomepageBanner } from "../homepage-banners.js";
import { sanitizeRichText } from "../rich-text.js";
import { persistLog } from "../logger.js";
import { categoryHref, productSlug } from "../seo.js";

type SessionUser = { id: string } | null;

type PaymentMethodRow = {
  id: string;
  title: string;
  type: "cardToCard" | "bankGateway" | "zarinpal";
  merchant_id: string | null;
  tax_percent: number | string;
};

type PaymentOrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  final_amount: number | string;
  payment_status: string;
  payment_method_id: string;
  payment_authority: string | null;
  payment_type: "cardToCard" | "bankGateway" | "zarinpal";
  merchant_id: string | null;
};

const getConfiguredPublicOrigin = () => {
  const configured = process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL;
  if (configured) return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  return null;
};

const getPublicOrigin = (request: FastifyRequest) => {
  const configured = getConfiguredPublicOrigin();
  if (configured) return configured;
  const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost:8080";
  const proto = request.headers["x-forwarded-proto"] || "http";
  return `${Array.isArray(proto) ? proto[0] : proto}://${Array.isArray(host) ? host[0] : host}`;
};

const isLocalOrigin = (origin: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(origin);
const sitemapFrequencyValues = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);

const xmlEscape = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const sitemapUrl = (origin: string, path: string) =>
  `${origin}${path.startsWith("/") ? path : `/${path}`}`;

const normalizeSitemapChangefreq = (value: unknown, fallback: string) => {
  const candidate = String(value || fallback || "monthly");
  return sitemapFrequencyValues.has(candidate) ? candidate : "monthly";
};
const normalizeSitemapPriority = (value: unknown, fallback: number) => {
  const candidate = Number(value ?? fallback);
  return Number.isFinite(candidate) && candidate >= 0 && candidate <= 1 ? candidate : fallback;
};

const articleReadingMinutes = (html: unknown) => {
  const words = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
};

const toPublicArticle = (row: Record<string, unknown>): Record<string, unknown> => ({
  ...toPublicRecord(row),
  readingMinutes: articleReadingMinutes(row.content)
});

const sitemapXml = (entries: { loc: string; lastmod?: string | null; changefreq: string; priority: number }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries.map((entry) =>
    `  <url>\n` +
    `    <loc>${xmlEscape(entry.loc)}</loc>\n` +
    (entry.lastmod ? `    <lastmod>${xmlEscape(new Date(entry.lastmod).toISOString())}</lastmod>\n` : "") +
    `    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>\n` +
    `    <priority>${entry.priority.toFixed(1)}</priority>\n` +
    `  </url>`
  ).join("\n") +
  `\n</urlset>\n`;

const toSitemapLastmod = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const sitemapIndexXml = (origin: string, entries: { path: string; lastmod?: unknown }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries.map((entry) => {
    const lastmod = toSitemapLastmod(entry.lastmod);
    return `  <sitemap>\n` +
      `    <loc>${xmlEscape(sitemapUrl(origin, entry.path))}</loc>\n` +
      (lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n` : "") +
      `  </sitemap>`;
  }).join("\n") +
  `\n</sitemapindex>\n`;

const normalizeRobotsRules = (value: unknown) =>
  String(value || "User-agent: *\nAllow: /")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^sitemap:/i.test(line.trim()))
    .join("\n")
    .trim();

const zarinpalErrorMessage = (payload: { data?: { message?: string }; errors?: unknown }) => {
  const errors = payload.errors as { message?: string; code?: number } | undefined;
  if (errors?.code === -14) {
    return "دامنه بازگشت پرداخت با دامنه ثبت‌شده در زرین‌پال یکی نیست. PUBLIC_SITE_URL را برابر دامنه تأییدشده زرین‌پال تنظیم کنید.";
  }
  if (errors?.message) return `خطای زرین‌پال: ${errors.message}`;
  return payload.data?.message || "اتصال به زرین‌پال ناموفق بود.";
};

const zarinpalAmount = (amountInToman: number) => {
  const multiplier = Number(process.env.ZARINPAL_AMOUNT_MULTIPLIER || 10);
  return Math.max(1, Math.round(amountInToman * multiplier));
};

const zarinpalStartUrl = (authority: string) => `https://www.zarinpal.com/pg/StartPay/${authority}`;

export const registerStoreRoutes = (
  app: FastifyInstance,
  pool: Pool,
  getCurrentUser: (request: FastifyRequest) => Promise<SessionUser>
) => {
  const orderService = new OrderService(pool);

  app.get("/api/v1/site-settings", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { item: await getPublicSiteSettings(pool) };
  });

  app.get("/api/v1/homepage-banners/:fileName", async (request, reply) => {
    const { fileName } = z.object({
      fileName: z.string().regex(/^homepage-banner-(?:desktop|mobile|row)-[0-9a-f-]+\.(?:jpg|png|webp)$/)
    }).parse(request.params);
    const banner = openHomepageBanner(fileName);
    if (!banner) return reply.code(404).send({ error: "بنر پیدا نشد." });
    reply.type(banner.mime).header("Cache-Control", "public, max-age=300");
    return reply.send(banner.stream);
  });

  app.get("/api/v1/indexing-policy", async (_request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.header("Cache-Control", "no-store");
    if (!settings.searchIndexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return reply.code(204).send();
  });

  app.get("/api/v1/search/popular", async (_request, reply) => {
    const [products, categories, tags] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT title_fa, title_en, slug, description, image_url
         FROM products
         WHERE is_active = true AND show_in_popular_searches = true
         ORDER BY sort_order ASC, created_at ASC
         LIMIT 8`
      ),
      pool.query<Record<string, unknown>>(
        `SELECT title, slug, seo_description, image_url
         FROM categories
         WHERE is_active = true AND show_in_popular_searches = true
         ORDER BY CASE slug
           WHEN 'coffee-blends' THEN 1
           WHEN 'cafe-drinks' THEN 2
           WHEN 'herbal-tea' THEN 3
           ELSE 20
         END, created_at ASC
         LIMIT 8`
      ),
      pool.query<Record<string, unknown>>(
        `SELECT title, slug, seo_description, image_url
         FROM tags
         WHERE show_in_popular_searches = true
         ORDER BY title ASC
         LIMIT 8`
      )
    ]);
    const items = [
      ...categories.rows.map((row) => ({
        type: "category",
        label: "دسته‌بندی",
        title: row.title,
        subtitle: row.seo_description || "مشاهده دسته‌بندی",
        href: categoryHref(String(row.slug || "")),
        imageUrl: row.image_url
      })),
      ...products.rows.map((row) => ({
        type: "product",
        label: "محصول",
        title: row.title_fa,
        subtitle: row.title_en || row.description,
        href: `/products/${encodeURIComponent(String(row.slug || productSlug(String(row.title_en || row.title_fa || ""))))}/`,
        imageUrl: row.image_url
      })),
      ...tags.rows.map((row) => ({
        type: "tag",
        label: "تگ",
        title: row.title,
        subtitle: row.seo_description || "مشاهده تگ",
        href: `/tags/${encodeURIComponent(String(row.slug || ""))}/`,
        imageUrl: row.image_url
      }))
    ].slice(0, 8);
    reply.header("Cache-Control", "no-store");
    return { items };
  });

  app.get("/api/v1/search", async (request, reply) => {
    const { q } = z.object({ q: z.string().trim().min(2).max(80) }).parse(request.query);
    const pattern = `%${q}%`;
    const [products, categories, tags, articles] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT id, title_fa, title_en, slug, description, image_url
         FROM products
         WHERE is_active = true
           AND (title_fa ILIKE $1 OR title_en ILIKE $1 OR description ILIKE $1)
         ORDER BY CASE
           WHEN title_fa ILIKE $2 OR title_en ILIKE $2 THEN 0
           ELSE 1
         END, sort_order ASC, created_at ASC
         LIMIT 6`,
        [pattern, `${q}%`]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT title, slug, seo_description, image_url
         FROM categories
         WHERE is_active = true
           AND (title ILIKE $1 OR slug ILIKE $1 OR COALESCE(seo_description, '') ILIKE $1)
         ORDER BY CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END, created_at ASC
         LIMIT 6`,
        [pattern, `${q}%`]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT title, slug, seo_description, image_url
         FROM tags
         WHERE title ILIKE $1 OR slug ILIKE $1 OR COALESCE(seo_description, '') ILIKE $1
         ORDER BY CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END, title ASC
         LIMIT 6`,
        [pattern, `${q}%`]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT title, slug, summary, image_url
         FROM articles
         WHERE is_published = true
           AND (title ILIKE $1 OR slug ILIKE $1 OR summary ILIKE $1)
         ORDER BY CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END, created_at DESC
         LIMIT 6`,
        [pattern, `${q}%`]
      )
    ]);
    const items = [
      ...products.rows.map((row) => ({
        type: "product",
        label: "محصول",
        title: row.title_fa,
        subtitle: row.title_en || row.description,
        href: `/products/${encodeURIComponent(String(row.slug || productSlug(String(row.title_en || ""))))}/`,
        imageUrl: row.image_url
      })),
      ...categories.rows.map((row) => ({
        type: "category",
        label: "دسته‌بندی",
        title: row.title,
        subtitle: row.seo_description || "مشاهده دسته‌بندی",
        href: categoryHref(String(row.slug || "")),
        imageUrl: row.image_url
      })),
      ...tags.rows.map((row) => ({
        type: "tag",
        label: "تگ",
        title: row.title,
        subtitle: row.seo_description || "مشاهده تگ",
        href: `/tags/${encodeURIComponent(String(row.slug || ""))}/`,
        imageUrl: row.image_url
      })),
      ...articles.rows.map((row) => ({
        type: "article",
        label: "مقاله",
        title: row.title,
        subtitle: row.summary,
        href: `/articles/${encodeURIComponent(String(row.slug || ""))}/`,
        imageUrl: row.image_url
      }))
    ].slice(0, 12);
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return { items };
  });

  app.get("/api/v1/categories/popular-footer", async (_request, reply) => {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT title, slug
       FROM categories
       WHERE is_active = true AND show_in_popular_footer = true
       ORDER BY CASE slug
         WHEN 'coffee-blends' THEN 1
         WHEN 'cafe-drinks' THEN 2
         WHEN 'herbal-tea' THEN 3
         ELSE 20
       END, created_at ASC
       LIMIT 8`
    );
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { items: result.rows.map(toPublicRecord) };
  });

  app.get("/api/v1/footer/quick-links", async (_request, reply) => {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT entity_type, title, slug, title_en, sort_order
       FROM (
         SELECT 'category'::text AS entity_type, title, slug, NULL::text AS title_en,
           sort_order, created_at
         FROM categories
         WHERE is_active = true AND show_in_popular_footer = true
         UNION ALL
         SELECT 'product'::text AS entity_type, title_fa AS title, slug, title_en,
           sort_order, created_at
         FROM products
         WHERE is_active = true AND show_in_popular_footer = true
       ) AS footer_links
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 8`
    );
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return { items: result.rows.map(toPublicRecord) };
  });

  app.get("/api/v1/categories/navigation", async (_request, reply) => {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT c.id, c.title, c.slug, c.sort_order, c.parent_category_id, c.image_url, c.mobile_image_url,
        COALESCE((
          SELECT json_agg(json_build_object('id', child.id, 'title', child.title, 'slug', child.slug, 'sortOrder', child.sort_order) ORDER BY
            child.sort_order ASC,
            child.created_at ASC
          )
          FROM categories child
          WHERE child.parent_category_id = c.id AND child.is_active = true
        ), '[]'::json) AS children
       FROM categories c
       WHERE c.is_active = true
         AND c.parent_category_id IS NULL
       ORDER BY c.sort_order ASC, c.created_at ASC`
    );
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { items: result.rows.map(toPublicRecord) };
  });

  app.get("/api/v1/storefront/resolve/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query(
      "SELECT 1 FROM categories WHERE slug=$1 AND is_active=true LIMIT 1",
      [slug]
    );
    reply.header("Cache-Control", "no-store");
    if (result.rowCount) return reply.code(301).header("Location", categoryHref(slug)).send();
    reply.header("X-Accel-Redirect", "/__product_detail");
    return reply.code(200).send();
  });

  app.get("/api/v1/storefront/category/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query(
      "SELECT 1 FROM categories WHERE slug=$1 AND is_active=true LIMIT 1",
      [slug]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "دسته‌بندی پیدا نشد." });
    reply.header("Cache-Control", "no-store");
    reply.header("X-Accel-Redirect", "/__category_detail");
    return reply.code(200).send();
  });

  app.get("/api/v1/storefront/article/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query<{ robots_index: boolean; robots_follow: boolean }>(
      "SELECT robots_index,robots_follow FROM articles WHERE slug=$1 AND is_published=true LIMIT 1",
      [slug]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "مقاله پیدا نشد." });
    const article = result.rows[0]!;
    reply.header("Cache-Control", "no-store");
    reply.header("X-Robots-Tag", `${article.robots_index ? "index" : "noindex"}, ${article.robots_follow ? "follow" : "nofollow"}`);
    reply.header("X-Accel-Redirect", "/__article_detail");
    return reply.code(200).send();
  });

  app.get("/api/v1/categories/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT c.id,c.title,c.slug,c.description,c.image_url,c.mobile_image_url,c.seo_title,c.seo_description,
          c.canonical_url,c.robots_index,c.robots_follow,
        COALESCE((
          SELECT json_agg(DISTINCT jsonb_build_object('id',t.id,'title',t.title,'slug',t.slug))
          FROM products p JOIN product_tags pt ON pt.product_id=p.id JOIN tags t ON t.id=pt.tag_id
          WHERE p.category_id=c.id AND p.is_active=true
        ), '[]'::json) AS tags
       FROM categories c WHERE c.slug=$1 AND c.is_active=true`,
      [slug]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "دسته‌بندی پیدا نشد." });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    const item = toPublicRecord(result.rows[0]);
    item.description = sanitizeRichText(String(item.description || ""));
    return { item };
  });

  app.get("/api/v1/tags/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT id,title,slug,image_url,content,seo_title,seo_description,canonical_url,robots_index,robots_follow FROM tags WHERE slug=$1`,
      [slug]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "تگ پیدا نشد." });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    const item = toPublicRecord(result.rows[0]);
    item.content = sanitizeRichText(String(item.content || ""));
    const [products, articles, relatedTags] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT p.id,p.title_fa,p.title_en,p.slug,p.description,p.image_url,p.blend_type,
                c.slug AS category_slug,c.title AS category_title
         FROM product_tags pt
         JOIN products p ON p.id=pt.product_id
         JOIN categories c ON c.id=p.category_id
         WHERE pt.tag_id=$1 AND p.is_active=true AND c.is_active=true
         ORDER BY p.sort_order,p.created_at`,
        [item.id]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT a.id,a.title,a.slug,a.summary,a.image_url,a.tags,
                COALESCE(a.published_at,a.created_at) AS created_at,a.updated_at,a.content
         FROM articles a
         WHERE a.is_published=true AND $1=ANY(a.tags)
         ORDER BY COALESCE(a.published_at,a.created_at) DESC
         LIMIT 12`,
        [item.title]
      ),
      pool.query<Record<string, unknown>>(
        `SELECT DISTINCT t.id,t.title,t.slug
         FROM product_tags current_pt
         JOIN product_tags sibling_pt ON sibling_pt.product_id=current_pt.product_id
         JOIN tags t ON t.id=sibling_pt.tag_id
         JOIN products p ON p.id=current_pt.product_id
         WHERE current_pt.tag_id=$1 AND t.id<>$1 AND p.is_active=true
         ORDER BY t.title`,
        [item.id]
      )
    ]);
    item.products = products.rows.map(toPublicRecord);
    item.articles = articles.rows.map((row) => {
      const { content: _content, ...article } = toPublicArticle(row);
      return article;
    });
    item.relatedTags = relatedTags.rows.map(toPublicRecord);
    return { item };
  });

  app.get("/api/v1/site-settings/robots.txt", async (request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "no-store");
    if (!settings.searchIndexingEnabled) return "User-agent: *\nDisallow: /\n";
    const rules = normalizeRobotsRules(settings.robotsRules);
    const sitemapLine = settings.sitemapEnabled === false ? "" : `\n\nSitemap: ${sitemapUrl(getPublicOrigin(request), "/sitemap.xml")}`;
    return `${rules || "User-agent: *\nAllow: /"}${sitemapLine}\n`;
  });

  app.get("/api/v1/site-settings/sitemap-index.xml", async (request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.type("application/xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=300");
    if (!settings.searchIndexingEnabled || settings.sitemapEnabled === false) {
      return sitemapIndexXml(getPublicOrigin(request), []);
    }
    const [products, categories, tags, articles] = await Promise.all([
      pool.query<{ total: string; lastmod: string | null }>(
        `SELECT count(*)::text AS total,max(p.updated_at)::text AS lastmod
           FROM products p JOIN categories c ON c.id=p.category_id
          WHERE p.is_active=true AND p.deleted_at IS NULL AND p.robots_index=true
            AND c.is_active=true AND c.deleted_at IS NULL`
      ),
      pool.query<{ total: string; lastmod: string | null }>(
        `SELECT count(*)::text AS total,max(updated_at)::text AS lastmod
           FROM categories
          WHERE is_active=true AND deleted_at IS NULL AND robots_index=true
            AND slug NOT IN ('products','articles','wholesale','order','about-orenza')`
      ),
      pool.query<{ total: string; lastmod: string | null }>(
        "SELECT count(*)::text AS total,max(updated_at)::text AS lastmod FROM tags WHERE robots_index=true"
      ),
      pool.query<{ total: string; lastmod: string | null }>(
        "SELECT count(*)::text AS total,max(updated_at)::text AS lastmod FROM articles WHERE is_published=true AND robots_index=true"
      )
    ]);
    const hasRows = (result: { rows: { total: string }[] }) => Number(result.rows[0]?.total || 0) > 0;
    const entries = [
      settings.sitemapHomepageEnabled !== false || settings.sitemapTermsEnabled !== false || settings.sitemapStaticEnabled !== false
        ? { path: "/sitemap/sitemap-statics.xml", lastmod: settings.updatedAt }
        : null,
      settings.sitemapProductsEnabled !== false && hasRows(products) ? { path: "/sitemap/sitemap-products.xml", lastmod: products.rows[0]?.lastmod } : null,
      settings.sitemapCategoriesEnabled !== false && hasRows(categories) ? { path: "/sitemap/sitemap-categories.xml", lastmod: categories.rows[0]?.lastmod } : null,
      settings.sitemapTagsEnabled !== false && hasRows(tags) ? { path: "/sitemap/sitemap-tags.xml", lastmod: tags.rows[0]?.lastmod } : null,
      settings.sitemapArticlesEnabled !== false && hasRows(articles) ? { path: "/sitemap/sitemap-blogs.xml", lastmod: articles.rows[0]?.lastmod } : null
    ].filter(Boolean) as { path: string; lastmod?: unknown }[];
    return sitemapIndexXml(getPublicOrigin(request), entries);
  });

  app.get("/api/v1/site-settings/sitemap/:kind.xml", async (request, reply) => {
    const { kind } = z.object({
      kind: z.enum([
        "statics", "products", "categories", "tags", "articles", "blogs",
        "sitemap-statics", "sitemap-products", "sitemap-categories", "sitemap-tags", "sitemap-articles", "sitemap-blogs"
      ])
    }).parse(request.params);
    const requestedKind = kind.replace(/^sitemap-/, "");
    const sitemapKind = requestedKind === "blogs" ? "articles" : requestedKind;
    const settings = await getSiteSettings(pool);
    const origin = getPublicOrigin(request);
    reply.type("application/xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=300");
    if (!settings.searchIndexingEnabled || settings.sitemapEnabled === false) return sitemapXml([]);
    if (sitemapKind === "statics") {
      if (settings.sitemapHomepageEnabled === false && settings.sitemapTermsEnabled === false && settings.sitemapStaticEnabled === false) return sitemapXml([]);
      const homepageChangefreq = normalizeSitemapChangefreq(settings.sitemapHomepageChangefreq, "monthly");
      const termsChangefreq = normalizeSitemapChangefreq(settings.sitemapTermsChangefreq, "monthly");
      const staticChangefreq = normalizeSitemapChangefreq(settings.sitemapStaticChangefreq, "monthly");
      const homepagePriority = normalizeSitemapPriority(settings.sitemapHomepagePriority, 0.9);
      const termsPriority = normalizeSitemapPriority(settings.sitemapTermsPriority, 0.9);
      const staticPriority = normalizeSitemapPriority(settings.sitemapStaticPriority, 0.8);
      return sitemapXml([
        settings.sitemapHomepageEnabled !== false
          ? { loc: sitemapUrl(origin, "/"), lastmod: String(settings.updatedAt || ""), changefreq: homepageChangefreq, priority: homepagePriority }
          : null,
        settings.sitemapTermsEnabled !== false
          ? { loc: sitemapUrl(origin, "/terms/"), lastmod: String(settings.updatedAt || ""), changefreq: termsChangefreq, priority: termsPriority }
          : null,
        ...(settings.sitemapStaticEnabled !== false ? ["/products/", "/articles/", "/order/", "/about/", "/contact/", "/wholesale/"].map((path) => ({
          loc: sitemapUrl(origin, path),
          lastmod: String(settings.updatedAt || ""),
          changefreq: staticChangefreq,
          priority: staticPriority
        })) : [])
      ].filter(Boolean) as { loc: string; lastmod: string; changefreq: string; priority: number }[]);
    }
    if (sitemapKind === "products") {
      if (settings.sitemapProductsEnabled === false) return sitemapXml([]);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT p.title_en,p.title_fa,p.slug,p.updated_at
         FROM products p JOIN categories c ON c.id=p.category_id
         WHERE p.is_active=true AND p.deleted_at IS NULL AND p.robots_index=true
           AND c.is_active=true AND c.deleted_at IS NULL
         ORDER BY p.sort_order ASC,p.created_at ASC`
      );
      return sitemapXml(result.rows.map((row) => ({
        loc: sitemapUrl(origin, `/products/${encodeURIComponent(String(row.slug || productSlug(String(row.title_en || row.title_fa || ""))))}/`),
        lastmod: String(row.updated_at || ""),
        changefreq: normalizeSitemapChangefreq(settings.sitemapProductsChangefreq, "monthly"),
        priority: normalizeSitemapPriority(settings.sitemapProductsPriority, 0.9)
      })));
    }
    if (sitemapKind === "categories") {
      if (settings.sitemapCategoriesEnabled === false) return sitemapXml([]);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT slug,updated_at
         FROM categories
         WHERE is_active=true AND deleted_at IS NULL AND robots_index=true
           AND slug NOT IN ('products','articles','wholesale','order','about-orenza')
         ORDER BY sort_order ASC,created_at ASC`
      );
      return sitemapXml(result.rows.map((row) => ({
        loc: sitemapUrl(origin, categoryHref(String(row.slug || ""))),
        lastmod: String(row.updated_at || ""),
        changefreq: normalizeSitemapChangefreq(settings.sitemapCategoriesChangefreq, "monthly"),
        priority: normalizeSitemapPriority(settings.sitemapCategoriesPriority, 0.8)
      })));
    }
    if (sitemapKind === "tags") {
      if (settings.sitemapTagsEnabled === false) return sitemapXml([]);
      const result = await pool.query<Record<string, unknown>>(
        `SELECT slug,updated_at
         FROM tags
         WHERE robots_index=true
         ORDER BY updated_at DESC`
      );
      return sitemapXml(result.rows.map((row) => ({
        loc: sitemapUrl(origin, `/tags/${encodeURIComponent(String(row.slug || ""))}/`),
        lastmod: String(row.updated_at || ""),
        changefreq: normalizeSitemapChangefreq(settings.sitemapTagsChangefreq, "monthly"),
        priority: normalizeSitemapPriority(settings.sitemapTagsPriority, 0.7)
      })));
    }
    if (settings.sitemapArticlesEnabled === false) return sitemapXml([]);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT slug,updated_at
       FROM articles
       WHERE is_published=true AND robots_index=true
       ORDER BY updated_at DESC`
    );
    return sitemapXml(result.rows.map((row) => ({
      loc: sitemapUrl(origin, `/articles/${encodeURIComponent(String(row.slug || ""))}/`),
      lastmod: String(row.updated_at || ""),
      changefreq: normalizeSitemapChangefreq(settings.sitemapArticlesChangefreq, "monthly"),
      priority: normalizeSitemapPriority(settings.sitemapArticlesPriority, 0.7)
    })));
  });

  app.get("/api/v1/articles", async (request, reply) => {
    const { limit, page, latest } = z.object({
      limit: z.coerce.number().int().min(1).max(24).default(12),
      page: z.coerce.number().int().min(1).default(1),
      latest: z.string().optional().transform((value) => value === "true")
    }).parse(request.query);
    const latestFilter = latest ? " AND a.show_in_latest=true" : "";
    const [items, count] = await Promise.all([
      pool.query<Record<string, unknown>>(
        `SELECT a.id,a.title,a.slug,a.summary,a.image_url,a.tags,
                COALESCE(a.published_at,a.created_at) AS created_at,a.updated_at,a.content,
                COALESCE((SELECT json_agg(json_build_object('title',t.title,'slug',t.slug) ORDER BY t.title)
                          FROM tags t WHERE t.title=ANY(a.tags)), '[]'::json) AS tag_links
           FROM articles a
          WHERE a.is_published=true${latestFilter}
          ORDER BY COALESCE(a.published_at,a.created_at) DESC
          LIMIT $1 OFFSET $2`,
        [limit, (page - 1) * limit]
      ),
      pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM articles a WHERE a.is_published=true${latestFilter}`)
    ]);
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return {
      items: items.rows.map((row) => {
        const { content: _content, ...article } = toPublicArticle(row);
        return article;
      }),
      total: Number(count.rows[0]?.total || 0),
      page,
      pageSize: limit
    };
  });

  app.get("/api/v1/articles/:slug", async (request, reply) => {
    const { slug } = z.object({
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }).parse(request.params);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT a.id,a.title,a.slug,a.summary,a.content,a.image_url,a.seo_title,a.seo_description,
              a.canonical_url,a.robots_index,a.robots_follow,a.tags,
              COALESCE(a.published_at,a.created_at) AS created_at,a.updated_at,
              COALESCE((SELECT json_agg(json_build_object('title',t.title,'slug',t.slug) ORDER BY t.title)
                        FROM tags t WHERE t.title=ANY(a.tags)), '[]'::json) AS tag_links
         FROM articles a
        WHERE a.slug=$1 AND a.is_published=true
        LIMIT 1`,
      [slug]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "مقاله پیدا نشد." });
    const related = await pool.query<Record<string, unknown>>(
      `SELECT a.id,a.title,a.slug,a.summary,a.image_url,a.tags,
              COALESCE(a.published_at,a.created_at) AS created_at,a.updated_at,a.content,
              COALESCE((SELECT json_agg(json_build_object('title',t.title,'slug',t.slug) ORDER BY t.title)
                        FROM tags t WHERE t.title=ANY(a.tags)), '[]'::json) AS tag_links
         FROM articles a
        WHERE a.is_published=true AND a.id<>$1
          AND (a.tags && $2::text[] OR cardinality($2::text[])=0)
        ORDER BY a.updated_at DESC
        LIMIT 3`,
      [result.rows[0].id, result.rows[0].tags || []]
    );
    const item = toPublicArticle(result.rows[0]);
    item.content = sanitizeRichText(String(item.content || ""));
    item.relatedArticles = related.rows.map((row) => {
      const { content: _content, ...article } = toPublicArticle(row);
      return article;
    });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { item };
  });

  app.get("/api/v1/products", async (request) => {
    const { category, relatedTo } = z.object({
      category: z.string().trim().max(180).optional(),
      relatedTo: z.string().uuid().optional()
    }).parse(request.query);
    const values: unknown[] = [];
    let productFilters = "";
    if (category) {
      values.push(category);
      productFilters += ` AND c.id IN (
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE slug = $${values.length} AND is_active = true
        UNION
        SELECT child.id FROM categories child
        JOIN category_tree parent ON child.parent_category_id = parent.id
        WHERE child.is_active = true
      )
      SELECT id FROM category_tree
    )`;
    }
    if (relatedTo) {
      values.push(relatedTo);
      productFilters += ` AND p.id IN (
        SELECT related_product_id FROM product_related_products WHERE product_id = $${values.length}
      )`;
    }
    const result = await pool.query<Record<string, unknown>>(
      `SELECT p.*, c.title AS category_title, c.slug AS category_slug,
        COALESCE((SELECT json_agg(json_build_object('id',t.id,'title',t.title,'slug',t.slug) ORDER BY t.title)
          FROM product_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.product_id=p.id), '[]'::json) AS tags,
        (p.sale_price_per_kg - p.purchase_price_per_kg) AS profit_per_kg,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.10)::bigint ELSE 0 END AS price_per_100g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.25)::bigint ELSE 0 END AS price_per_250g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.50)::bigint ELSE 0 END AS price_per_500g,
        CASE WHEN p.sale_type = 'weighted' THEN p.sale_price_per_kg ELSE 0 END AS price_per_1000g,
        CASE WHEN p.sale_type = 'packaged' THEN p.sale_price_per_kg ELSE 0 END AS package_price
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true AND c.is_active = true${productFilters}
       ORDER BY p.sort_order ASC, p.created_at ASC`,
      values
    );
    return {
      items: result.rows.map((row) => {
        const item = toPublicRecord(row);
        item.productContent = sanitizeRichText(String(item.productContent || ""));
        return item;
      })
    };
  });

  app.get("/api/v1/products/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT p.*, c.title AS category_title, c.slug AS category_slug,
        COALESCE((SELECT json_agg(json_build_object('id',t.id,'title',t.title,'slug',t.slug) ORDER BY t.title)
          FROM product_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.product_id=p.id), '[]'::json) AS tags,
        COALESCE((SELECT json_agg(json_build_object(
          'id',rp.id,'titleFa',rp.title_fa,'titleEn',rp.title_en,'slug',rp.slug,'description',rp.description,
          'productType',rp.product_type,'blendType',rp.blend_type,'roastType',rp.roast_type,'coffeeType',rp.coffee_type,
          'saleType',rp.sale_type,'stockStatus',rp.stock_status,'packageWeightGrams',rp.package_weight_grams,
          'availableWeightsGrams',rp.available_weights_grams,'packagePrice',
            CASE WHEN rp.sale_type = 'packaged' THEN rp.sale_price_per_kg ELSE 0 END,
          'salePricePerKg',rp.sale_price_per_kg,'discountPercent',rp.discount_percent,
          'discountSalePricePerKg',rp.discount_sale_price_per_kg,'productImageUrls',rp.product_image_urls,
          'showInDiscounts',rp.show_in_discounts,'imageUrl',rp.image_url,'categorySlug',rc.slug
        ) ORDER BY prp.created_at)
          FROM product_related_products prp
          JOIN products rp ON rp.id=prp.related_product_id AND rp.is_active=true
          JOIN categories rc ON rc.id=rp.category_id AND rc.is_active=true
          WHERE prp.product_id=p.id), '[]'::json) AS related_products,
        (p.sale_price_per_kg - p.purchase_price_per_kg) AS profit_per_kg,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.25)::bigint ELSE 0 END AS price_per_250g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.50)::bigint ELSE 0 END AS price_per_500g,
        CASE WHEN p.sale_type = 'weighted' THEN p.sale_price_per_kg ELSE 0 END AS price_per_1000g,
        CASE WHEN p.sale_type = 'packaged' THEN p.sale_price_per_kg ELSE 0 END AS package_price
       FROM products p JOIN categories c ON c.id=p.category_id
       WHERE p.id=$1 AND p.is_active=true AND c.is_active=true`,
      [id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "محصول پیدا نشد." });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    const item = toPublicRecord(result.rows[0]);
    item.productContent = sanitizeRichText(String(item.productContent || ""));
    return { item };
  });

  app.get("/api/v1/product-images/:fileName", async (request, reply) => {
    const { fileName } = z.object({
      fileName: z.string().regex(/^[0-9a-f-]+\.(?:jpg|png|webp)$/)
    }).parse(request.params);
    const image = openProductImage(fileName);
    if (!image) return reply.code(404).send({ error: "تصویر محصول پیدا نشد." });
    reply.type(image.mime).header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(image.stream);
  });

  app.get("/api/v1/payment-methods/active", async () => {
    const result = await pool.query<PaymentMethodRow>(
      `SELECT id,title,type,merchant_id,tax_percent
       FROM payment_methods
       WHERE is_active = true AND type IN ('cardToCard','zarinpal')
       ORDER BY CASE WHEN type = 'zarinpal' THEN 0 WHEN type = 'cardToCard' THEN 1 ELSE 2 END, created_at DESC`
    );
    if (!result.rows.length) return { item: null, methods: [] };

    const cards = await pool.query<Record<string, unknown>>(
      `SELECT id,payment_method_id,card_number,sheba_number,account_number,account_owner,bank_name
       FROM payment_cards WHERE is_active = true ORDER BY created_at`
    );
    const cardsByMethod = new Map<string, Record<string, unknown>[]>();
    cards.rows.forEach((card) => {
      const methodId = String(card.payment_method_id);
      cardsByMethod.set(methodId, [...(cardsByMethod.get(methodId) || []), card]);
    });

    const methods = result.rows.map((method) => ({
      id: method.id,
      title: method.title,
      type: method.type,
      merchantId: method.merchant_id,
      taxPercent: Number(method.tax_percent || 0),
      cards: (cardsByMethod.get(method.id) || []).map(toPublicRecord)
    }));
    const fallbackItem = methods.find((method) => method.type === "cardToCard") || methods[0] || null;
    return { item: fallbackItem, methods };
  });

  app.get("/api/v1/shipping-methods/active", async () => {
    const result = await pool.query<Record<string, unknown>>(
      `SELECT id,title,code,description,pricing_type,base_price,price_per_kg,price_per_volume
       FROM shipping_methods
       WHERE is_active = true
       ORDER BY sort_order ASC, created_at ASC`
    );
    return { items: result.rows.map(toPublicRecord) };
  });

  app.post("/api/v1/discounts/validate", async (request) => {
    const data = z.object({
      code: z.string().trim().min(3).max(60),
      totalAmount: z.number().int().min(0),
      paymentMethodId: z.string().uuid().optional()
    }).parse(request.body);
    return orderService.validateDiscount(data.code, data.totalAmount, data.paymentMethodId);
  });

  app.post("/api/v1/orders", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const order = await orderService.create(request.body, user?.id ?? null);
    return reply.code(201).send({ order });
  });

  app.post("/api/v1/orders/card-transfer", {
    bodyLimit: 25 * 1024 * 1024,
    config: { rateLimit: { max: 8, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const part = await request.file();
    if (!part || part.fieldname !== "receipt") {
      return reply.code(422).send({ error: "تصویر فیش واریزی را انتخاب کنید." });
    }
    const buffer = await part.toBuffer();
    const payloadField = part.fields.payload;
    const rawPayload = payloadField && "value" in payloadField ? String(payloadField.value) : "";
    if (!rawPayload) return reply.code(422).send({ error: "اطلاعات سفارش کامل نیست." });

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      return reply.code(422).send({ error: "اطلاعات سفارش معتبر نیست." });
    }
    const saved = await savePaymentReceipt(buffer);
    try {
      const user = await getCurrentUser(request);
      const order = await orderService.create({ ...(parsedPayload as Record<string, unknown>), paymentReceiptUrl: saved.url }, user?.id ?? null);
      return reply.code(201).send({ order });
    } catch (error) {
      await removePaymentReceipt(saved.fileName);
      throw error;
    }
  });

  app.post("/api/v1/payments/zarinpal/request", { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const data = z.object({ orderId: z.string().uuid() }).parse(request.body);
    const result = await pool.query<PaymentOrderRow>(
      `SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.final_amount,o.payment_status,
              o.payment_method_id,o.payment_authority,pm.type AS payment_type,pm.merchant_id
       FROM orders o JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = $1 LIMIT 1`,
      [data.orderId]
    );
    const order = result.rows[0];
    if (!order) return reply.code(404).send({ error: "سفارش پیدا نشد." });
    if (order.payment_type !== "zarinpal") return reply.code(400).send({ error: "روش پرداخت این سفارش زرین‌پال نیست." });
    if (order.payment_status === "paid") return reply.code(400).send({ error: "این سفارش قبلاً پرداخت شده است." });
    if (!order.merchant_id) return reply.code(400).send({ error: "کد پذیرنده زرین‌پال در پنل مدیریت ثبت نشده است." });

    const publicOrigin = getPublicOrigin(request);
    if (!getConfiguredPublicOrigin() && isLocalOrigin(publicOrigin)) {
      return reply.code(400).send({
        error: "زرین‌پال callback لوکال را قبول نمی‌کند. برای پرداخت واقعی PUBLIC_SITE_URL را برابر دامنه ثبت‌شده در زرین‌پال، مثل https://orenza.ir، تنظیم کنید."
      });
    }
    const callbackUrl = `${publicOrigin}/api/v1/payments/zarinpal/callback?orderId=${encodeURIComponent(order.id)}`;
    const amount = zarinpalAmount(Number(order.final_amount));
    const zarinpalResponse = await fetch("https://api.zarinpal.com/pg/v4/payment/request.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: order.merchant_id,
        amount,
        callback_url: callbackUrl,
        description: `پرداخت سفارش ${order.order_number} اورنزا`,
        metadata: { mobile: order.customer_phone }
      })
    });
    const payload = await zarinpalResponse.json() as { data?: { code?: number; authority?: string; message?: string }; errors?: unknown };
    const authority = payload.data?.authority;
    if (!zarinpalResponse.ok || payload.data?.code !== 100 || !authority) {
      request.log.warn({ zarinpal: payload, callbackUrl, orderId: order.id }, "zarinpal payment request failed");
      return reply.code(502).send({ error: zarinpalErrorMessage(payload) });
    }
    await orderService.markPaymentStarted(order.id, authority);
    return { authority, url: zarinpalStartUrl(authority) };
  });

  app.get("/api/v1/payments/zarinpal/callback", async (request, reply) => {
    const data = z.object({
      orderId: z.string().uuid(),
      Authority: z.string().trim().min(4).optional(),
      Status: z.string().trim().optional()
    }).parse(request.query);
    const redirectBase = `${getPublicOrigin(request)}/payment-result/`;
    const fail = async (reason: string, authority?: string) => {
      await orderService.markPaymentRejected(data.orderId, authority || data.Authority || null);
      return reply.redirect(`${redirectBase}?status=failed&reason=${encodeURIComponent(reason)}&order=${encodeURIComponent(data.orderId)}`);
    };
    if (data.Status !== "OK" || !data.Authority) return fail("پرداخت توسط کاربر لغو شد.");

    const result = await pool.query<PaymentOrderRow>(
      `SELECT o.id,o.order_number,o.final_amount,o.payment_status,o.payment_method_id,o.payment_authority,
              o.customer_name,o.customer_phone,pm.type AS payment_type,pm.merchant_id
       FROM orders o JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = $1 LIMIT 1`,
      [data.orderId]
    );
    const order = result.rows[0];
    if (!order) return reply.redirect(`${redirectBase}?status=failed&reason=${encodeURIComponent("سفارش پیدا نشد.")}`);
    if (order.payment_type !== "zarinpal" || !order.merchant_id) return fail("اطلاعات پرداخت سفارش کامل نیست.", data.Authority);

    const verifyResponse = await fetch("https://api.zarinpal.com/pg/v4/payment/verify.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: order.merchant_id,
        amount: zarinpalAmount(Number(order.final_amount)),
        authority: data.Authority
      })
    });
    const payload = await verifyResponse.json() as { data?: { code?: number; ref_id?: number | string; message?: string }; errors?: unknown };
    if (verifyResponse.ok && (payload.data?.code === 100 || payload.data?.code === 101)) {
      await orderService.markPaymentVerified(order.id, data.Authority, String(payload.data.ref_id || ""));
      return reply.redirect(`${redirectBase}?status=success&order=${encodeURIComponent(order.order_number)}&ref=${encodeURIComponent(String(payload.data.ref_id || ""))}`);
    }

    request.log.warn({ zarinpal: payload, orderId: order.id }, "zarinpal payment verify failed");
    return fail(zarinpalErrorMessage(payload) || "تأیید پرداخت ناموفق بود.", data.Authority);
  });

  app.post("/api/v1/analytics/visit", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = z.object({
      visitorId: z.string().uuid(),
      path: z.string().trim().min(1).max(300).regex(/^\/(?!\/)/)
    }).parse(request.body);
    await pool.query(
      `INSERT INTO site_visits (visitor_id,path) VALUES ($1,$2)
       ON CONFLICT (visitor_id,path,visited_on) DO NOTHING`,
      [data.visitorId, data.path.split("?")[0]]
    );
    return reply.code(204).send();
  });

  app.post("/api/v1/analytics/client-log", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = z.object({
      level: z.enum(["info", "warn", "error"]),
      event: z.string().trim().min(1).max(80),
      data: z.record(z.string(), z.unknown()).default({}),
      path: z.string().trim().min(1).max(500),
      clientId: z.string().uuid(),
      userAgent: z.string().max(300).optional()
    }).parse(request.body);
    const log = {
      event: "client_event",
      clientEvent: data.event,
      clientId: data.clientId,
      path: data.path,
      data: data.data,
      userAgent: data.userAgent
    };
    request.log[data.level](log, "Client event");
    persistLog({ level: data.level, event: data.event, message: "Client event", requestId: request.id, metadata: log });
    return reply.code(204).send();
  });
};
