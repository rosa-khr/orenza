import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { toPublicRecord } from "../admin/repository.js";
import { getPublicSiteSettings, getSiteSettings } from "../site-settings.js";
import { OrderService } from "./order-service.js";

type SessionUser = { id: string } | null;

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

  app.get("/api/v1/indexing-policy", async (_request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.header("Cache-Control", "no-store");
    if (!settings.searchIndexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return reply.code(204).send();
  });

  app.get("/api/v1/site-settings/robots.txt", async (_request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "no-store");
    return settings.searchIndexingEnabled
      ? "User-agent: *\nAllow: /\n\nSitemap: https://orenza.ir/sitemap-index.xml\n"
      : "User-agent: *\nDisallow: /\n";
  });

  app.get("/api/v1/products", async (request) => {
    const { category } = z.object({ category: z.string().trim().max(180).optional() }).parse(request.query);
    const values: unknown[] = [];
    const categoryFilter = category ? " AND c.slug = $1" : "";
    if (category) values.push(category);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT p.*, c.title AS category_title, c.slug AS category_slug,
        (p.sale_price_per_kg - p.purchase_price_per_kg) AS profit_per_kg,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.10)::bigint ELSE 0 END AS price_per_100g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.25)::bigint ELSE 0 END AS price_per_250g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.50)::bigint ELSE 0 END AS price_per_500g,
        CASE WHEN p.sale_type = 'weighted' THEN p.sale_price_per_kg ELSE 0 END AS price_per_1000g,
        CASE WHEN p.sale_type = 'packaged' THEN p.sale_price_per_kg ELSE 0 END AS package_price
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true AND c.is_active = true${categoryFilter}
       ORDER BY p.sort_order ASC, p.created_at ASC`,
      values
    );
    return { items: result.rows.map(toPublicRecord) };
  });

  app.get("/api/v1/payment-methods/active", async () => {
    const result = await pool.query<Record<string, unknown>>(
      "SELECT * FROM payment_methods WHERE is_active = true AND type = 'cardToCard' ORDER BY created_at DESC LIMIT 1"
    );
    if (!result.rows[0]) return { item: null };
    const method = toPublicRecord(result.rows[0]);
    const cards = await pool.query<Record<string, unknown>>(
      `SELECT id,payment_method_id,card_number,sheba_number,account_number,account_owner,bank_name
       FROM payment_cards WHERE payment_method_id = $1 AND is_active = true ORDER BY created_at`,
      [result.rows[0].id]
    );
    return { item: { ...method, cards: cards.rows.map(toPublicRecord) } };
  });

  app.post("/api/v1/discounts/validate", async (request) => {
    const data = z.object({
      code: z.string().trim().min(3).max(60),
      totalAmount: z.number().int().min(0)
    }).parse(request.body);
    return orderService.validateDiscount(data.code, data.totalAmount);
  });

  app.post("/api/v1/orders", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const order = await orderService.create(request.body, user?.id ?? null);
    return reply.code(201).send({ order });
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
};
