const allowedTags = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "h2", "h3",
  "ul", "ol", "li", "a", "blockquote"
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

const sanitizeTag = (rawTag: string) => {
  const match = rawTag.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
  if (!match) return "";
  const closing = Boolean(match[1]);
  const tag = match[2]!.toLowerCase();
  const attributes = match[3] || "";
  if (!allowedTags.has(tag)) return "";
  if (tag === "br") return closing ? "" : "<br>";
  if (closing) return `</${tag}>`;
  if (tag !== "a") return `<${tag}>`;
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
