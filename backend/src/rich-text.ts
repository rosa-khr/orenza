const allowedTags = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "h2", "h3",
  "ul", "ol", "li", "a", "blockquote", "figure", "figcaption", "img",
  "table", "thead", "tbody", "tr", "th", "td"
]);

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const decodeHref = (value: string) => value
  .replace(/&colon;/gi, ":")
  .replace(/&amp;/gi, "&")
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .trim();

const safeHref = (value: string) => {
  const href = decodeHref(value).replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (/^https?:\/\//i.test(href) || /^(mailto:|tel:)/i.test(href)) return href;
  if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
  return "";
};
const safeImageSrc = (value: string) => {
  const src = decodeHref(value);
  if (/^https:\/\//i.test(src)) return src;
  if (/^\/api\/v1\/product-images\/[0-9a-f-]+\.(?:jpg|png|webp)$/i.test(src)) return src;
  return "";
};

const sanitizeTag = (rawTag: string) => {
  const match = rawTag.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
  if (!match) return "";
  const closing = Boolean(match[1]);
  const tag = match[2]!.toLowerCase();
  const attributes = match[3] || "";
  if (!allowedTags.has(tag)) return "";
  if (tag === "br") return closing ? "" : "<br>";
  if (tag === "img") {
    if (closing) return "";
    const srcMatch = attributes.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const altMatch = attributes.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const widthMatch = attributes.match(/\bwidth\s*=\s*(?:"(\d{2,4})"|'(\d{2,4})'|(\d{2,4}))/i);
    const heightMatch = attributes.match(/\bheight\s*=\s*(?:"(\d{2,4})"|'(\d{2,4})'|(\d{2,4}))/i);
    const src = safeImageSrc(srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || "");
    if (!src) return "";
    const alt = (altMatch?.[1] || altMatch?.[2] || altMatch?.[3] || "").slice(0, 240);
    const width = widthMatch?.[1] || widthMatch?.[2] || widthMatch?.[3] || "";
    const height = heightMatch?.[1] || heightMatch?.[2] || heightMatch?.[3] || "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${width ? ` width="${width}"` : ""}${height ? ` height="${height}"` : ""}>`;
  }
  if (closing) return `</${tag}>`;
  if (tag !== "a") {
    const alignMatch = attributes.match(/(?:text-align\s*:\s*|\balign\s*=\s*["']?)(right|center|left)/i);
    const align = ["p", "h2", "h3", "blockquote", "th", "td"].includes(tag) ? alignMatch?.[1]?.toLowerCase() : "";
    return `<${tag}${align ? ` style="text-align:${align}"` : ""}>`;
  }
  const hrefMatch = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = safeHref(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "");
  if (!href) return "";
  const external = /^https?:\/\//i.test(href);
  return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
};

export const sanitizeRichText = (value: string | null | undefined) => {
  const source = String(value || "")
    .replace(/<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .trim();
  if (!source) return null;
  if (!/<[^>]+>/.test(source)) {
    return source
      .split(/\n\s*\n/)
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll("\n", "<br>")}</p>`)
      .join("");
  }
  let result = "";
  let cursor = 0;
  let suppressedAnchorDepth = 0;
  for (const match of source.matchAll(/<[^>]*>/g)) {
    const index = match.index ?? cursor;
    result += escapeHtml(source.slice(cursor, index));
    const tagMatch = match[0].match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    const closing = Boolean(tagMatch?.[1]);
    const tag = tagMatch?.[2]?.toLowerCase();
    const sanitizedTag = sanitizeTag(match[0]);
    if (tag === "a" && !closing && !sanitizedTag) suppressedAnchorDepth += 1;
    else if (tag === "a" && closing && suppressedAnchorDepth > 0) suppressedAnchorDepth -= 1;
    else result += sanitizedTag;
    cursor = index + match[0].length;
  }
  result += escapeHtml(source.slice(cursor));
  return result.trim() || null;
};
