import assert from "node:assert/strict";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const cases = [
  ["article", "/articles/how-to-choose-coffee-for-your-taste/", "how-to-choose-coffee-for-your-taste"],
  ["product", "/products/100-robusta/", "100-robusta"],
  ["category", "/category/coffee/", "coffee"],
  ["tag", "/tags/buy-coffee/", "buy-coffee"],
];

const results = [];
for (const [type, path, expectedSlug] of cases) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const html = await response.text();
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1];
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']robots["']/i)?.[1];
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, "").trim();
  const xRobots = response.headers.get("x-robots-tag");

  assert.equal(response.status, 200, `${path} did not return 200`);
  assert.equal(canonical, `${baseUrl}${path}`, `${path} is not self-canonical`);
  assert.match(robots || "", /index/i, `${path} lacks index meta robots`);
  assert.match(xRobots || "", /index/i, `${path} lacks index X-Robots-Tag`);
  assert.ok(h1 && !/در حال دریافت|پیدا نشد/.test(h1), `${path} lacks a real server-rendered H1`);
  assert.ok(html.includes(expectedSlug), `${path} initial HTML lacks its content identifier`);
  if (type === "article") {
    assert.match(html, /"(?:@type)"\s*:\s*"BlogPosting"/, "Article lacks server-rendered BlogPosting JSON-LD");
    assert.ok(html.length > 10_000, "Article initial HTML is unexpectedly small");
  }
  results.push({ type, path, status: response.status, canonical, robots, xRobots, h1, bytes: html.length });
}

const sitemapResponse = await fetch(`${baseUrl}/sitemap/sitemap-articles.xml`);
const sitemap = await sitemapResponse.text();
assert.equal(sitemapResponse.status, 200, "Article sitemap did not return 200");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
for (const slug of ["how-to-choose-coffee-for-your-taste", "coffee-grind-size-guide", "keep-coffee-fresh-longer"]) {
  assert.ok(sitemapUrls.some((url) => url.endsWith(`/articles/${slug}/`)), `Article sitemap lacks ${slug}`);
}

console.log(JSON.stringify({ status: "PASS", pages: results, articleSitemapUrls: sitemapUrls }, null, 2));
