# Orenza Post-Deployment Validation Report

**دامنه:** `https://orenza.ir`  
**تاریخ انتشار و بررسی:** 2026-10-18 (Asia/Tehran)  
**Commit منتشرشده:** `65d440d6442136e35b7cf17d938100cc813a1221`  
**نتیجه انتشار:** **PASS — با موارد باقی‌مانده ثبت‌شده**

## Executive Summary

اصلاحات Technical SEO با روش استاندارد پروژه (`git pull --ff-only` و `docker compose up -d --build`) روی Production منتشر شد. پیش از انتشار، بکاپ PostgreSQL با فرمت custom گرفته شد و با restore کامل در یک دیتابیس موقت و تطبیق شمارش رکوردها اعتبارسنجی شد.

Build فرانت‌اند و Backend، هفت تست SEO، migration، تست integration واقعی SSR/Sitemap و smoke test مرورگر برای وزن، قیمت، سبد و Checkout همگی موفق بودند. هیچ سفارش یا تراکنش واقعی در تست ساخته نشد.

پس از انتشار، هر ۵۶ URL موجود در پنج زیرسایت‌مپ از نظر HTTP 200، نبود redirect، نبود `noindex` و self-canonical بودن PASS شدند. شش مقاله منتشرشده در Sitemap مقالات حضور دارند. سرویس‌ها healthy هستند و در لاگ‌های پس از انتشار خطای 500، exception یا خطای Nginx مشاهده نشد.

دو نقص غیرمسدودکننده باقی است:

1. Tag نمونه `buy-coffee` عنوان، H1، canonical و robots صحیح دارد، اما چون فیلد محتوای آن در دیتابیس خالی است، محتوای متنی اصلی آن در HTML اولیه خالی است؛ فهرست محصول مرتبط همچنان با JavaScript بارگذاری می‌شود.
2. Product/Offer JSON-LD هنوز روی صفحات محصول وجود ندارد. داده ساختگی برای تکمیل آن تولید نشده است.

این موارد باعث Rollback نشدند، چون هیچ regression عملیاتی، از دست‌رفتن داده، خطای HTTP، noindex یا canonical ناسازگار در URLهای Sitemap مشاهده نشد.

## Deployment and Rollback Evidence

### Backup و Restore Verification

دستور اجراشده روی سرور:

```bash
/tmp/orenza-production-backup.sh
```

خروجی واقعی:

```text
BACKUP_DIR=/opt/orenza/backups/20261018-203041
DUMP_BYTES=23593948
RESTORE_OBJECTS=176
VERIFIED_COUNTS=25|23|5|6|13
SHA256=25d671ef1b86c11a4d7f58df1ac849b22096de9b55e80b1862ca65f614933209
```

ترتیب شمارش‌ها: `products|orders|users|articles|categories`.

بکاپ شامل موارد زیر است:

- `orenza.dump` با فرمت PostgreSQL custom
- `orenza.dump.sha256`
- فهرست ۱۷۶ آبجکت قابل restore
- شمارش رکوردهای بازیابی‌شده
- commit قبلی، شناسه imageهای قبلی و نسخه محافظت‌شده `.env`

Restore در دیتابیس موقت مستقل انجام شد، شمارش‌ها دقیقاً با مبدا برابر بود و دیتابیس موقت پس از تست حذف شد.

### Rollback State

نسخه قبل از انتشار:

```text
Git commit: 0768f71301062b453a1a96e17f8630135bc534c9
orenza-api:rollback-0768f71
  sha256:2d05a47caa70f0802d08fddbd878545f356677d324e858ed56411c6803f71e09
orenza-coffee:rollback-0768f71
  sha256:5723f4c2b0ab58852390c79b05b93d4e172a94aa4cf206f55099257f8b457028
```

Rollback اجرا نشد، زیرا معیار خطای جدی برقرار نشد.

## Pre-Deployment Validation

### Build و SEO Regression

```bash
npm run test:seo
```

نتیجه واقعی:

```text
Astro check: 0 errors, 0 warnings, 6 hints
Frontend build: 83 pages built
Backend TypeScript build: PASS
SEO tests: 7 passed, 0 failed
```

هفت تست شامل indexability صفحات عمومی، noindex صفحات خصوصی، robots.txt، قوانین Nginx، SSR مقاله، robots محصول و SSR دسته‌بندی/Tag بود.

### Docker، Nginx و Migration در محیط Local

```bash
docker compose up -d --build
docker compose exec -T web nginx -t
```

نتیجه:

```text
db: healthy
api: healthy
web: healthy
nginx configuration test is successful
```

شمارش داده‌های Local قبل و بعد از migration بدون تغییر ماند:

```text
products=12, orders=19, users=2, articles=3, categories=10
migration marker=1
article_sitemap_enabled=true
```

یک ایراد واقعی در اولین تست integration پیدا و پیش از Deploy اصلاح شد: API container به templateهای Article/Category/Tag داخل Web container دسترسی نداشت و مقاله 500 می‌داد. template endpointهای داخلی و متغیرهای مربوط به آن‌ها اضافه شدند و دسترسی عمومی آن‌ها با 404 بسته شد.

### Local SSR/Sitemap Integration

```bash
node tests/predeploy-seo-integration.mjs
```

نتیجه: **PASS**

```text
Article: 200, self-canonical, index/follow, initial content, BlogPosting
Product: 200, self-canonical, index/follow, initial product data
Category: 200, self-canonical, index/follow, initial H1/content
Tag: 200, self-canonical, index/follow, initial H1/content
Article sitemap: all 3 local published articles present
```

### Local Commerce Smoke Test

```bash
node tests/predeploy-browser-smoke.mjs
```

نتیجه: **PASS — non-transactional**

```text
چای ماسالا: 250g -> 500g
price: 555,000 -> 1,110,000 تومان
cart items: 1
checkout items: 1
submittedOrder: false
```

## Production Deployment

```bash
git pull --ff-only origin dev
docker compose config -q
docker compose up -d --build
```

نتیجه:

```text
Commit: 65d440d6442136e35b7cf17d938100cc813a1221
Compose config: PASS
Frontend: 83 pages built, 0 errors
Backend TypeScript build: PASS
Database migration completed
api: healthy
web: healthy
db: healthy
```

imageهای نهایی:

```text
orenza-api:latest
sha256:508298a6b9b3128d33bda6fce1e201ed42bc59ec0cfa450e3303b768e5832d85

orenza-coffee:latest
sha256:349d4d1023386b3d587e2825e29b17e9d8c65fabedf5ad729f7110a3c9f90231
```

## Production URL Validation

دستور ممیزی:

```bash
node /private/tmp/orenza-postdeploy-audit.mjs
```

| نوع | URL | HTTP | Meta Robots | X-Robots-Tag | Canonical | H1/Initial HTML | نتیجه |
|---|---|---:|---|---|---|---|---|
| Article | `/articles/decaf-coffee-guide/` | 200 | index, follow | index, follow | self | محتوای مقاله + BlogPosting | PASS |
| Article | `/articles/ganoderma-coffee-guide/` | 200 | index, follow | index, follow | self | محتوای مقاله + BlogPosting | PASS |
| Article | `/articles/arabica-vs-robusta/` | 200 | index, follow | index, follow | self | محتوای مقاله + BlogPosting | PASS |
| Product | `/products/masala-chai/` | 200 | index, follow | index, follow | self | H1 و داده محصول | PASS |
| Product | `/products/kerak-tea/` | 200 | index, follow | index, follow | self | H1 و داده محصول | PASS |
| Product | `/products/100-robusta/` | 200 | index, follow | index, follow | self | H1 و داده محصول | PASS |
| Category | `/category/coffee-blends/` | 200 | index, follow | index, follow | self | H1 و متن اولیه | PASS |
| Category | `/category/cafe-drinks/` | 200 | index, follow | index, follow | self | H1 و متن اولیه | PASS |
| Category | `/category/coffee/` | 200 | index, follow | index, follow | self | H1 و متن اولیه | PASS |
| Tag | `/tags/buy-coffee/` | 200 | index, follow | index, follow | self | H1 موجود؛ متن اصلی خالی | FAIL |
| Private | `/account/profile/` | 200 | noindex, nofollow | noindex, nofollow, noarchive | self | صفحه خصوصی | PASS |

هر سه مقاله نمونه Title و H1 واقعی، محتوای اصلی در HTML اولیه و JSON-LD نوع `BlogPosting` دارند. هیچ‌کدام به اجرای JavaScript برای محتوای مقاله وابسته نیستند.

## Sitemap Validation

```bash
node /private/tmp/orenza-sitemap-sweep.mjs
```

خروجی واقعی:

| Sitemap | HTTP | URL | PASS | FAIL |
|---|---:|---:|---:|---:|
| `sitemap-statics.xml` | 200 | 10 | 10 | 0 |
| `sitemap-products.xml` | 200 | 23 | 23 | 0 |
| `sitemap-categories.xml` | 200 | 7 | 7 | 0 |
| `sitemap-tags.xml` | 200 | 10 | 10 | 0 |
| `sitemap-articles.xml` | 200 | 6 | 6 | 0 |
| **Total** | — | **56** | **56** | **0** |

معیار هر URL: HTTP 200، بدون redirect، بدون `noindex` در Meta یا header و canonical دقیقاً برابر URL سایت‌مپ.

Sitemap Index اکنون `sitemap-articles.xml` را معرفی می‌کند و هر شش مقاله published در آن حضور دارند:

```text
decaf-coffee-guide
ganoderma-coffee-guide
coffee-grind-size-guide
keep-coffee-fresh-longer
arabica-vs-robusta
how-to-choose-coffee-for-your-taste
```

## robots.txt and Internal Route Security

```bash
curl -fsS -D - https://orenza.ir/robots.txt
```

نتیجه:

```text
HTTP 200
Allow: /
Allow: /_assets/
Allow: /images/
Disallow: /admin/
Disallow: /account/
Disallow: /login/
Disallow: /checkout/
Disallow: /payment/
Disallow: /api/
Sitemap: https://orenza.ir/sitemap.xml
```

templateهای داخلی از اینترنت قابل دریافت نیستند:

```text
/_product-template  404
/_article-template  404
/_category-template 404
/_tag-template      404
```

## Production Commerce Validation

```bash
BASE_URL=https://orenza.ir node tests/predeploy-browser-smoke.mjs
```

نتیجه واقعی: **PASS — بدون ثبت سفارش یا تراکنش**

```text
Product: چای ماسالا
Weights: 250g, 500g, 1000g
Initial price: 633,750 تومان
500g price: 1,267,500 تومان
Cart items: 1
Cart weight: 500g
Cart unit price: 1,267,500 تومان
Checkout items: 1
Checkout subtotal: 1,267,500 تومان
Register order control: present
submittedOrder: false
```

شمارش سفارش‌ها پیش و پس از این تست `23` باقی ماند.

## Data Preservation

| داده | قبل از Deploy | بعد از Deploy و Smoke Test | نتیجه |
|---|---:|---:|---|
| Products | 25 | 25 | PASS |
| Orders | 23 | 23 | PASS |
| Users | 5 | 5 | PASS |
| Articles | 6 | 6 | PASS |
| Categories | 13 | 13 | PASS |

volume دیتابیس و volumeهای تصاویر محصول، رسیدها و امضای فاکتور حذف یا recreate نشدند.

## Nginx and Server Logs

```bash
nginx -t
systemctl is-active nginx
docker compose exec -T web nginx -t
docker compose logs --since=15m api web | grep ...
```

خروجی:

```text
Host nginx syntax: successful
Host nginx service: active
Container nginx syntax: successful
API/Web 500 or exception scan: no matches
Host Nginx error scan: no matches
```

## Structured Data Status

| Schema | وضعیت Production |
|---|---|
| Organization | PASS |
| WebSite | PASS |
| WebPage | PASS |
| BlogPosting برای مقاله | PASS در هر سه نمونه |
| BreadcrumbList | PASS در مقاله، محصول و دسته‌بندی |
| Product / Offer | FAIL — هنوز پیاده‌سازی نشده |

هیچ داده قیمت، موجودی یا Review ساختگی برای Schema ایجاد نشده است.

## Remaining Issues

1. **Tag thin/empty initial content:** رکورد `buy-coffee` دارای `content length=0` و یک محصول مرتبط است. H1/canonical/robots صحیح‌اند، اما متن و فهرست محصول مرتبط باید SSR شوند یا این Tag تا تکمیل محتوا از Sitemap خارج شود.
2. **Product/Offer schema:** باید فقط از قیمت، currency و availability واقعی محصول ساخته شود.
3. فهرست محصولات مرتبط و برخی listingها همچنان client-rendered هستند؛ جزئیات اصلی محصول و مقاله SSR هستند.
4. Build دارای ۶ hint قدیمی و هشدار chunkهای بزرگ Admin است؛ خطای build نیست.
5. `@yaireo/tagify` حداقل Node 22 اعلام کرده، در حالی که image build روی Node 20 است؛ build و runtime فعلی موفق‌اند، اما ارتقای Node باید جداگانه آزمایش شود.
6. Checkout تا حضور کنترل ثبت سفارش و محاسبه مبلغ تست شد؛ خود submit عمداً اجرا نشد تا سفارش/تراکنش واقعی ایجاد نشود.

## Final Status

| حوزه | نتیجه |
|---|---|
| Database backup and restore | PASS |
| Build and automated SEO tests | PASS |
| Migration and data preservation | PASS |
| Production service health | PASS |
| Article SSR/indexability | PASS |
| Product and category indexability | PASS |
| Sitemap index and all 56 URLs | PASS |
| Weight/price/cart/Checkout smoke | PASS |
| Nginx and server error scan | PASS |
| Tag initial main content | FAIL — non-blocking remaining issue |
| Product/Offer structured data | FAIL — remaining enhancement |
| Rollback required | NO |

**نتیجه نهایی:** Deploy عملیاتی و اصلاحات اصلی Technical SEO با موفقیت تأیید شدند. دو نقص ثبت‌شده فوق باید در iteration بعدی برطرف شوند، اما هیچ خطای جدی برای Rollback مشاهده نشد.
