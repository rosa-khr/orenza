import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderArticleDetailPage } from "../backend/dist/article-page.js";
import { renderProductDetailPage } from "../backend/dist/product-page.js";
import { renderContentPage } from "../backend/dist/content-page.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const meta = (html, name) => html.match(new RegExp(`<meta name=["']${name}["'][^>]*content=["']([^"']*)`, "i"))?.[1] || "";
const canonical = (html) => html.match(/<link rel=["']canonical["'][^>]*href=["']([^"']*)/i)?.[1] || "";
const h1Text = (html) => (html.match(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();

test("public static pages are indexable and self canonical in initial HTML", async () => {
  const pages = new Map([
    ["dist/index.html", "https://orenza.ir/"],
    ["dist/products/index.html", "https://orenza.ir/products/"],
    ["dist/categories/index.html", "https://orenza.ir/categories/"],
    ["dist/articles/index.html", "https://orenza.ir/articles/"],
    ["dist/category/coffee-blends/index.html", "https://orenza.ir/category/coffee-blends/"],
    ["dist/about/index.html", "https://orenza.ir/about/"],
    ["dist/contact/index.html", "https://orenza.ir/contact/"],
    ["dist/wholesale/index.html", "https://orenza.ir/wholesale/"]
  ]);
  for (const [path, expectedCanonical] of pages) {
    const html = await read(path);
    assert.match(meta(html, "robots"), /^index, follow/);
    assert.equal(canonical(html), expectedCanonical);
    assert.match(html, /<title>[^<]{3,}<\/title>/);
    assert.ok(h1Text(html).length >= 2, `${path} must have a meaningful server-rendered H1`);
  }
});

test("private and transactional pages are noindex", async () => {
  for (const path of ["dist/login/index.html", "dist/account/profile/index.html", "dist/payment-result/index.html", "dist/order-success/index.html", "dist/404.html"]) {
    assert.match(meta(await read(path), "robots"), /^noindex, nofollow/);
  }
});

test("robots.txt protects private routes without blocking public content or assets", async () => {
  const robots = await read("public/robots.txt");
  for (const path of ["/admin/", "/account/", "/login/", "/checkout/", "/api/"]) assert.match(robots, new RegExp(`Disallow: ${path.replace(/\//g, "\\/")}`));
  for (const path of ["/products/", "/articles/", "/category/", "/_assets/"]) assert.doesNotMatch(robots, new RegExp(`Disallow: ${path.replace(/\//g, "\\/")}`));
  assert.match(robots, /Sitemap: https:\/\/orenza\.ir\/sitemap\.xml/);
});

test("nginx preserves 404s for non-public templates and sends HTTP noindex on private routes", async () => {
  const nginx = await read("nginx.conf");
  assert.match(nginx, /location = \/products\/detail\/ \{\s*return 404;/);
  assert.match(nginx, /location = \/articles\/detail\/ \{\s*return 404;/);
  assert.match(nginx, /location \^~ \/category-template\/ \{\s*return 404;/);
  assert.match(nginx, /location ~ \^\/(?:\(\?:)?account[\s\S]*?add_header X-Robots-Tag "noindex, nofollow, noarchive" always;/);
});

test("article renderer emits server-visible content and aligned SEO URLs", async () => {
  const template = await read("dist/articles/detail/index.html");
  const canonicalUrl = "https://orenza.ir/articles/server-rendered-guide/";
  const html = renderArticleDetailPage(template, canonicalUrl, {
    title: "راهنمای تست رندر سرور", slug: "server-rendered-guide", summary: "خلاصه مستقل و واقعی مقاله برای آزمون رگرسیون.",
    content: "<h2>محتوای اصلی</h2><p>این متن باید در HTML اولیه و بدون اجرای جاوااسکریپت دیده شود.</p>",
    seoTitle: "عنوان سئوی مقاله", seoDescription: "توضیحات متای اختصاصی و معتبر مقاله برای آزمون.", canonicalUrl: null,
    imageUrl: "/images/espresso-extraction-editorial-v2.webp", tags: ["قهوه"], tagLinks: [],
    createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-02T10:00:00.000Z", readingMinutes: 4,
    robotsIndex: true, robotsFollow: true, relatedArticles: []
  });
  assert.equal(canonical(html), canonicalUrl);
  assert.match(html, new RegExp(`<meta property="og:url" content="${canonicalUrl}"`));
  assert.match(meta(html, "robots"), /^index, follow/);
  assert.match(html, /<h1[^>]*>راهنمای تست رندر سرور<\/h1>/);
  assert.match(html, /این متن باید در HTML اولیه/);
  assert.match(html, /"mainEntityOfPage":\{"@type":"WebPage","@id":"https:\/\/orenza\.ir\/articles\/server-rendered-guide\/"/);
  assert.doesNotMatch(html, /__ARTICLE_|article-seo\.invalid|در حال دریافت مقاله/);
});

test("product renderer keeps meta robots aligned with an intentional noindex", async () => {
  const template = await read("dist/products/detail/index.html");
  const html = renderProductDetailPage(template, "https://orenza.ir/products/test-product/", {
    titleFa: "محصول آزمایشی", titleEn: "Test Product", description: "توضیح کافی برای محصول آزمایشی",
    slug: "test-product", robotsIndex: false, robotsFollow: true, stockStatus: "inStock", productType: "other"
  });
  assert.equal(meta(html, "robots"), "noindex, follow");
  assert.equal(canonical(html), "https://orenza.ir/products/test-product/");
});

test("dynamic category and tag renderers emit initial H1, content and self canonicals", async () => {
  const category = renderContentPage(await read("dist/category-template/index.html"), "category", "https://orenza.ir/category/organic-products/", {
    title: "محصولات ارگانیک", slug: "organic-products", description: "<p>محتوای مستقل دسته‌بندی ارگانیک.</p>", seoDescription: "معرفی محصولات ارگانیک اورنزا", robotsIndex: true, robotsFollow: true
  });
  assert.equal(canonical(category), "https://orenza.ir/category/organic-products/");
  assert.equal(h1Text(category), "محصولات ارگانیک");
  assert.match(category, /محتوای مستقل دسته‌بندی ارگانیک/);
  const tag = renderContentPage(await read("dist/tags/detail/index.html"), "tag", "https://orenza.ir/tags/fresh-roasted-coffee/", {
    title: "قهوه تازه رست", slug: "fresh-roasted-coffee", content: "<p>راهنمای کامل قهوه تازه رست.</p>", seoDescription: "محتوای قهوه تازه رست", robotsIndex: true, robotsFollow: true
  });
  assert.equal(canonical(tag), "https://orenza.ir/tags/fresh-roasted-coffee/");
  assert.equal(h1Text(tag), "قهوه تازه رست");
  assert.match(tag, /راهنمای کامل قهوه تازه رست/);
});
