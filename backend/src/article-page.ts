import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const canonicalPlaceholder = "https://article-seo.invalid/__ARTICLE_CANONICAL_HTML__/";
const placeholders = {
  canonicalJson: "__ARTICLE_CANONICAL_JSON__",
  seoTitle: "__ARTICLE_SEO_TITLE_HTML__",
  seoFullTitleJson: "__ARTICLE_SEO_FULL_TITLE_JSON__",
  seoDescription: "__ARTICLE_SEO_DESCRIPTION_HTML__",
  seoDescriptionJson: "__ARTICLE_SEO_DESCRIPTION_JSON__",
  title: "__ARTICLE_TITLE_HTML__",
  summary: "__ARTICLE_SUMMARY_HTML__",
  category: "__ARTICLE_CATEGORY_HTML__",
  dateIso: "__ARTICLE_DATE_ISO_HTML__",
  date: "__ARTICLE_DATE_HTML__",
  reading: "__ARTICLE_READING_HTML__",
  image: "__ARTICLE_IMAGE_HTML__",
  imageAlt: "__ARTICLE_IMAGE_ALT_HTML__",
  content: "__ARTICLE_CONTENT_HTML__",
  tags: "__ARTICLE_TAGS_HTML__",
  related: "__ARTICLE_RELATED_HTML__",
  data: "__ARTICLE_DATA_JSON__"
} as const;

const required = [canonicalPlaceholder, ...Object.values(placeholders)];
let cachedTemplate: string | null = null;

const validateTemplate = (template: string, source: string) => {
  const missing = required.filter((value) => !template.includes(value));
  if (missing.length) throw new Error(`Article detail template is missing SEO placeholders (${missing.join(", ")}): ${source}`);
  return template;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeJsonString = (value: string) => JSON.stringify(value).slice(1, -1);
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export type ArticlePageData = Record<string, unknown> & {
  title: string; slug: string; summary: string; content: string;
  seoTitle?: string | null; seoDescription?: string | null; canonicalUrl?: string | null;
  imageUrl?: string | null; tags?: string[]; tagLinks?: { title: string; slug: string }[];
  createdAt: string; updatedAt: string; readingMinutes: number;
  robotsIndex?: boolean; robotsFollow?: boolean; relatedArticles?: Record<string, unknown>[];
};

export const articleCanonicalUrl = (origin: string, slug: string, configured?: string | null) => {
  const url = new URL(configured || `/articles/${encodeURIComponent(slug)}/`, `${origin}/`);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (!url.pathname.endsWith("/") && !url.pathname.includes(".")) url.pathname += "/";
  return url.toString();
};

export const loadArticleDetailTemplate = async () => {
  if (cachedTemplate) return cachedTemplate;
  const candidates = [
    process.env.ARTICLE_DETAIL_TEMPLATE_PATH,
    resolve(process.cwd(), "templates/article-detail.html"),
    resolve(process.cwd(), "../dist/articles/detail/index.html"),
    resolve(process.cwd(), "dist/articles/detail/index.html")
  ].filter((path): path is string => Boolean(path));
  let lastError: unknown;
  for (const path of candidates) {
    try {
      const template = await readFile(path, "utf8");
      cachedTemplate = validateTemplate(template, path);
      return template;
    } catch (error) { lastError = error; }
  }
  const templateUrl = process.env.ARTICLE_DETAIL_TEMPLATE_URL;
  if (templateUrl) {
    try {
      const response = await fetch(templateUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`Article detail template returned HTTP ${response.status}.`);
      const template = await response.text();
      cachedTemplate = validateTemplate(template, templateUrl);
      return template;
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Article detail template was not found.");
};

export const renderArticleDetailPage = (template: string, canonicalUrl: string, article: ArticlePageData) => {
  const origin = new URL(canonicalUrl).origin;
  const title = String(article.seoTitle || article.title);
  const fullTitle = `${title} | اورنزا`;
  const description = String(article.seoDescription || article.summary);
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const tagLinks = Array.isArray(article.tagLinks) ? article.tagLinks : [];
  const image = new URL(String(article.imageUrl || "/images/espresso-extraction-editorial-v2.webp"), origin).toString();
  const createdAt = new Date(article.createdAt);
  const dateText = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" }).format(createdAt);
  const tagsHtml = tags.map((tag) => {
    const linked = tagLinks.find((item) => item.title === tag);
    return linked
      ? `<a href="/tags/${encodeURIComponent(linked.slug)}/"># ${escapeHtml(tag)}</a>`
      : `<span># ${escapeHtml(tag)}</span>`;
  }).join("");
  const relatedHtml = (article.relatedArticles || []).map((raw) => {
    const item = raw as Record<string, unknown>;
    const relatedImage = new URL(String(item.imageUrl || "/images/espresso-extraction-editorial-v2.webp"), origin).toString();
    return `<article><a href="/articles/${encodeURIComponent(String(item.slug || ""))}/"><img src="${escapeHtml(relatedImage)}" alt="تصویر شاخص مقاله ${escapeHtml(item.title)}" width="420" height="250" loading="lazy" decoding="async"><div><span>${escapeHtml((item.tags as string[] | undefined)?.[0] || "دانستنی‌های قهوه")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div></a></article>`;
  }).join("");
  const values = new Map<string, string>([
    [canonicalPlaceholder, escapeHtml(canonicalUrl)],
    [placeholders.canonicalJson, escapeJsonString(canonicalUrl)],
    [placeholders.seoTitle, escapeHtml(title)],
    [placeholders.seoFullTitleJson, escapeJsonString(fullTitle)],
    [placeholders.seoDescription, escapeHtml(description)],
    [placeholders.seoDescriptionJson, escapeJsonString(description)],
    [placeholders.title, escapeHtml(article.title)],
    [placeholders.summary, escapeHtml(article.summary)],
    [placeholders.category, escapeHtml(tags[0] || "دانستنی‌های قهوه")],
    [placeholders.dateIso, escapeHtml(createdAt.toISOString())],
    [placeholders.date, escapeHtml(dateText)],
    [placeholders.reading, `${escapeHtml(new Intl.NumberFormat("fa-IR").format(article.readingMinutes))} دقیقه مطالعه`],
    [placeholders.image, escapeHtml(image)],
    [placeholders.imageAlt, escapeHtml(`تصویر شاخص مقاله ${article.title}`)],
    [placeholders.content, String(article.content || "")],
    [placeholders.tags, tagsHtml],
    [placeholders.related, relatedHtml],
    [placeholders.data, safeJson({ item: article })]
  ]);
  const pattern = new RegExp([...values.keys()].sort((a, b) => b.length - a.length).map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  let rendered = template.replace(pattern, (value) => values.get(value) ?? value);
  const robots = `${article.robotsIndex === false ? "noindex" : "index"}, ${article.robotsFollow === false ? "nofollow" : "follow"}${article.robotsIndex === false ? "" : ", max-image-preview:large"}`;
  rendered = rendered
    .replace(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${robots}"`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${escapeHtml(`تصویر شاخص مقاله ${article.title}`)}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`);
  const schema = {
    "@context": "https://schema.org", "@graph": [{
      "@type": "BlogPosting", "@id": `${canonicalUrl}#article`, headline: article.title, description,
      image: [image], datePublished: article.createdAt, dateModified: article.updatedAt, inLanguage: "fa-IR",
      mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
      author: { "@type": "Organization", name: "تحریریه اورنزا", url: origin },
      publisher: { "@type": "Organization", name: "قهوه اورنزا", url: origin, logo: { "@type": "ImageObject", url: `${origin}/images/orenza-logo.png` } },
      articleSection: tags[0] || "دانستنی‌های قهوه", keywords: tags.join(", ")
    }, { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "مجله قهوه", item: `${origin}/articles/` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonicalUrl }
    ] }]
  };
  return rendered.replace("</head>", `<script type="application/ld+json" data-article-schema>${safeJson(schema)}</script></head>`);
};
