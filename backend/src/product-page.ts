import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const htmlCanonicalPlaceholder = "https://product-seo.invalid/__PRODUCT_CANONICAL_HTML__/";
const jsonCanonicalPlaceholder = "__PRODUCT_CANONICAL_JSON__";
const placeholders = {
  seoTitleHtml: "__PRODUCT_SEO_TITLE_HTML__",
  seoDescriptionHtml: "__PRODUCT_SEO_DESCRIPTION_HTML__",
  seoTitleJson: "__PRODUCT_SEO_TITLE_JSON__",
  seoDescriptionJson: "__PRODUCT_SEO_DESCRIPTION_JSON__",
  titleFaHtml: "__PRODUCT_TITLE_FA_HTML__",
  titleEnHtml: "__PRODUCT_TITLE_EN_HTML__",
  descriptionHtml: "__PRODUCT_DESCRIPTION_HTML__",
  blendHtml: "__PRODUCT_BLEND_HTML__",
  roastHtml: "__PRODUCT_ROAST_HTML__",
  coffeeSpecStyleHtml: "__PRODUCT_COFFEE_SPEC_STYLE_HTML__",
  stockHtml: "__PRODUCT_STOCK_HTML__",
  productDataJson: "__PRODUCT_DATA_JSON__"
} as const;
const requiredPlaceholders = [htmlCanonicalPlaceholder, jsonCanonicalPlaceholder, ...Object.values(placeholders)];

const validateTemplate = (template: string, source: string) => {
  const missing = requiredPlaceholders.filter((placeholder) => !template.includes(placeholder));
  if (missing.length) throw new Error(`Product detail template is missing SEO placeholders (${missing.join(", ")}): ${source}`);
  return template;
};

let cachedTemplate: string | null = null;

const templateCandidates = () => [
  process.env.PRODUCT_DETAIL_TEMPLATE_PATH,
  resolve(process.cwd(), "templates/product-detail.html"),
  resolve(process.cwd(), "../dist/products/detail/index.html"),
  resolve(process.cwd(), "dist/products/detail/index.html")
].filter((path): path is string => Boolean(path));

export const loadProductDetailTemplate = async () => {
  if (cachedTemplate) return cachedTemplate;
  let lastError: unknown;
  for (const path of templateCandidates()) {
    try {
      const template = await readFile(path, "utf8");
      cachedTemplate = validateTemplate(template, path);
      return template;
    } catch (error) {
      lastError = error;
    }
  }
  const templateUrl = process.env.PRODUCT_DETAIL_TEMPLATE_URL;
  if (templateUrl) {
    try {
      const response = await fetch(templateUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) throw new Error(`Product detail template returned HTTP ${response.status}.`);
      const template = await response.text();
      cachedTemplate = validateTemplate(template, templateUrl);
      return template;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Product detail template was not found.");
};

const escapeHtmlAttribute = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/"/g, "&quot;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const escapeJsonStringContent = (value: string) => JSON.stringify(value).slice(1, -1);

const safeInlineJson = (value: unknown) => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

type ProductPageData = Record<string, unknown> & {
  titleFa: string;
  titleEn: string;
  description: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  blendType?: string | null;
  productType?: "coffee" | "herbalTea" | "instantDrink" | "food" | "other";
  roastType?: "light" | "medium" | "mediumDark" | "dark" | null;
  stockStatus?: "inStock" | "outOfStock";
};

const roastLabels = {
  light: "روشن",
  medium: "متوسط",
  mediumDark: "متوسط رو به تیره",
  dark: "تیره"
} as const;

const hydrationFields = [
  "id", "slug", "titleFa", "titleEn", "description", "seoTitle", "seoDescription",
  "productContent", "imageUrl", "productImageUrls", "blendType", "productType", "categorySlug",
  "roastType", "coffeeType", "saleType", "stockStatus", "packageWeightGrams", "availableWeightsGrams",
  "packagePrice", "salePricePerKg", "discountPercent", "discountSalePricePerKg", "canonicalUrl",
  "robotsIndex", "robotsFollow", "pricePer250g", "pricePer500g", "pricePer1000g", "tags",
  "relatedProducts", "showInDiscounts"
] as const;

const productHydrationData = (product: ProductPageData) => Object.fromEntries(
  hydrationFields.flatMap((field) => field in product ? [[field, product[field]]] : [])
);

export const renderProductDetailPage = (template: string, canonicalUrl: string, product: ProductPageData) => {
  const seoTitle = String(product.seoTitle || product.titleFa);
  const fullSeoTitle = `${seoTitle} | اورنزا`;
  const seoDescription = String(product.seoDescription || product.description);
  const values = new Map<string, string>([
    [htmlCanonicalPlaceholder, escapeHtmlAttribute(canonicalUrl)],
    [jsonCanonicalPlaceholder, escapeJsonStringContent(canonicalUrl)],
    [placeholders.seoTitleHtml, escapeHtmlAttribute(seoTitle)],
    [placeholders.seoDescriptionHtml, escapeHtmlAttribute(seoDescription)],
    [placeholders.seoTitleJson, escapeJsonStringContent(fullSeoTitle)],
    [placeholders.seoDescriptionJson, escapeJsonStringContent(seoDescription)],
    [placeholders.titleFaHtml, escapeHtmlAttribute(product.titleFa)],
    [placeholders.titleEnHtml, escapeHtmlAttribute(product.titleEn)],
    [placeholders.descriptionHtml, escapeHtmlAttribute(product.description)],
    [placeholders.blendHtml, escapeHtmlAttribute(String(product.blendType || "محصول اورنزا"))],
    [placeholders.roastHtml, escapeHtmlAttribute(product.roastType ? roastLabels[product.roastType] : "—")],
    [placeholders.coffeeSpecStyleHtml, product.productType === "coffee" ? "" : "display:none"],
    [placeholders.stockHtml, escapeHtmlAttribute(product.stockStatus === "outOfStock" ? "ناموجود" : "موجود و قابل سفارش")],
    [placeholders.productDataJson, safeInlineJson({ item: productHydrationData(product) })]
  ]);
  const pattern = new RegExp(
    [...values.keys()]
      .sort((first, second) => second.length - first.length)
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|"),
    "g"
  );
  return template.replace(pattern, (placeholder) => values.get(placeholder) ?? placeholder);
};

export const productCanonicalUrl = (origin: string, slug: string, configuredCanonical?: string | null) => {
  const url = new URL(configuredCanonical || `/products/${encodeURIComponent(slug)}/`, `${origin}/`);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (!url.pathname.endsWith("/") && !url.pathname.includes(".")) url.pathname += "/";
  return url.toString();
};
