import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type ContentKind = "category" | "tag";
type ContentPageData = Record<string, unknown> & {
  title: string; slug: string; description?: string | null; content?: string | null;
  seoTitle?: string | null; seoDescription?: string | null; canonicalUrl?: string | null;
  robotsIndex?: boolean; robotsFollow?: boolean; imageUrl?: string | null;
};

const templates = new Map<ContentKind, string>();
const defaults = {
  category: {
    paths: ["templates/category.html", "../dist/category-template/index.html", "dist/category-template/index.html"],
    canonical: "https://orenza.ir/category-template/",
    title: "دسته‌بندی محصولات اورنزا",
    description: "محصولات این دسته‌بندی را در فروشگاه اورنزا ببینید."
  },
  tag: {
    paths: ["templates/tag.html", "../dist/tags/detail/index.html", "dist/tags/detail/index.html"],
    canonical: "https://orenza.ir/tags/detail/",
    title: "برچسب محصولات اورنزا",
    description: "محتوا و محصولات مرتبط با برچسب‌های اورنزا"
  }
} as const;

const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const validateTemplate = (template: string, kind: ContentKind, source: string) => {
  const fallback = defaults[kind];
  const required = kind === "category"
    ? [fallback.canonical, "data-category-title", "data-category-content"]
    : [fallback.canonical, "data-tag-title", "data-tag-content"];
  const missing = required.filter((value) => !template.includes(value));
  if (missing.length) throw new Error(`${kind} template is missing placeholders (${missing.join(", ")}): ${source}`);
  return template;
};

export const contentCanonicalUrl = (origin: string, kind: ContentKind, slug: string, configured?: string | null) => {
  const url = new URL(configured || `/${kind === "category" ? "category" : "tags"}/${encodeURIComponent(slug)}/`, `${origin}/`);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (!url.pathname.endsWith("/") && !url.pathname.includes(".")) url.pathname += "/";
  return url.toString();
};

export const loadContentTemplate = async (kind: ContentKind) => {
  const cached = templates.get(kind);
  if (cached) return cached;
  let lastError: unknown;
  for (const candidate of defaults[kind].paths) {
    try {
      const template = await readFile(resolve(process.cwd(), candidate), "utf8");
      templates.set(kind, validateTemplate(template, kind, candidate));
      return template;
    } catch (error) { lastError = error; }
  }
  const templateUrl = process.env[kind === "category" ? "CATEGORY_DETAIL_TEMPLATE_URL" : "TAG_DETAIL_TEMPLATE_URL"];
  if (templateUrl) {
    try {
      const response = await fetch(templateUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`${kind} template returned HTTP ${response.status}.`);
      const template = await response.text();
      templates.set(kind, validateTemplate(template, kind, templateUrl));
      return template;
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error(`${kind} template was not found.`);
};

export const renderContentPage = (template: string, kind: ContentKind, canonicalUrl: string, item: ContentPageData) => {
  const fallback = defaults[kind];
  const seoTitle = String(item.seoTitle || item.title);
  const description = String(item.seoDescription || item.description || item.content || `${item.title} در اورنزا`).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
  const robots = `${item.robotsIndex === false ? "noindex" : "index"}, ${item.robotsFollow === false ? "nofollow" : "follow"}${item.robotsIndex === false ? "" : ", max-image-preview:large"}`;
  let html = template
    .split(fallback.canonical).join(canonicalUrl)
    .split(fallback.title).join(escapeHtml(seoTitle))
    .split(fallback.description).join(escapeHtml(description))
    .replace(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${robots}"`);
  if (item.imageUrl) {
    const image = new URL(String(item.imageUrl), new URL(canonicalUrl).origin).toString();
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`).replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${escapeHtml(image)}$2`);
  }
  if (kind === "category") {
    html = html
      .replace(/(<h1 data-category-title>)[\s\S]*?(<\/h1>)/, `$1${escapeHtml(item.title)}$2`)
      .replace(/(<p data-category-lead>)[\s\S]*?(<\/p>)/, `$1${escapeHtml(String(item.seoDescription || ""))}$2`)
      .replace(/<div class="category-admin-content" data-category-content hidden><\/div>/, `<div class="category-admin-content" data-category-content>${String(item.description || "")}</div>`);
  } else {
    html = html
      .replace(/(<h1 data-tag-title>)[\s\S]*?(<\/h1>)/, `$1${escapeHtml(item.title)}$2`)
      .replace(/<section class="tag-detail-content" data-tag-content hidden><\/section>/, `<section class="tag-detail-content" data-tag-content>${String(item.content || "")}</section>`);
  }
  return html;
};
