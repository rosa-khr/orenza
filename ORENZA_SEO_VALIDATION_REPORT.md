# گزارش اعتبارسنجی Technical SEO سایت Orenza

**دامنه:** `https://orenza.ir`  
**تاریخ بررسی:** 2026-10-18  
**محیط زمانی گزارش:** Asia/Tehran  
**وضعیت انتشار اصلاحات:** **اصلاحات موجود در Working Tree هنوز Deploy نشده‌اند.**  
**قاعده گزارش:** نتایج Production و Local کاملاً جدا هستند. هیچ نتیجه محلی به‌عنوان تأیید سایت زنده گزارش نشده است.

## Executive Summary

### Production فعلی

وضعیت Production هنوز نشان‌دهنده نسخه قبل از اصلاح است:

- صفحه اصلی و سه محصول نمونه از نظر HTTP، Meta Robots، canonical، Title و H1 در HTML اولیه قابل قبول‌اند.
- هر سه مقاله نمونه با HTTP 200 پاسخ می‌دهند، اما HTML اولیه آن‌ها canonical اشتباه `/articles/detail/`، Title عمومی، H1 برابر «در حال دریافت مقاله…» و بدنه مقاله خالی دارد. محتوای واقعی فقط از API و پس از JavaScript قابل دریافت است.
- سه دسته‌بندی اصلی نمونه canonical و H1 صحیح دارند، زیرا نسخه‌های Static Astro آن‌ها در Production موجود است؛ بااین‌حال بخش داده‌محور محصولات همچنان client-rendered است.
- Tag نمونه در HTML اولیه canonical اشتباه `/tags/detail/`، H1 موقت و محتوای خالی دارد.
- Sitemap Index فعلی شامل Sitemap مقاله نیست. هر دو endpoint مربوط به `sitemap-articles.xml` و `sitemap-blogs.xml` صفر URL دارند، در حالی که API عمومی ۶ مقاله منتشرشده را برمی‌گرداند.
- از ۵۸ URL موجود در Sitemapهای فعلی، ۳۴ URL self-canonical و قابل ایندکس تشخیص داده شدند. ۴ دسته‌بندی پویا و تمام ۲۰ Tag موجود در Sitemap canonical صحیح ندارند؛ بنابراین از دید این ممیزی، قابل ایندکس سالم محسوب نمی‌شوند.
- Product/Offer schema در سه محصول نمونه وجود ندارد. صفحات محصول فقط `Organization`، `WebSite`، `WebPage` و `BreadcrumbList` دارند.
- اجرای Chrome Headless برای مقایسه DOM رندرشده به پاسخ 500 انجامید، درحالی‌که همان URLها با curl پاسخ 200 داشتند. بنابراین مقایسه مرورگر Production به‌عنوان **NOT TESTED** ثبت شده و نتیجه فرضی ارائه نشده است.

### کد Local اصلاح‌شده

- SSR برای مقاله، دسته‌بندی دیتابیسی و Tag اضافه شده است.
- Meta Robots، `X-Robots-Tag`، canonical، `og:url` و WebPage/BlogPosting URL در rendererهای جدید هم‌راستا شده‌اند.
- Sitemap مقالات با migration یک‌باره فعال می‌شود.
- URLهای non-canonical از Sitemap حذف می‌شوند و Tagهای فاقد حداقل ارزش محتوایی/ارتباطی فیلتر می‌شوند.
- تنظیمات Index/Follow در پنل مدیریت قابل مشاهده شده، تغییر عمدی آن‌ها امکان‌پذیر است، برای انتشار با noindex هشدار وجود دارد و تغییرات در Audit Log ثبت می‌شوند.
- Build فرانت‌اند و Backend موفق است و ۷ تست SEO regression عبور می‌کنند.
- Product/Offer schema، SSR کامل فهرست‌ها و E2E واقعی خرید/Checkout هنوز باقی مانده‌اند.

## Test Methodology and Status Definitions

- **PASS:** نتیجه واقعی با انتظار فنی آن URL منطبق است.
- **FAIL:** یک مانع مستقیم indexability/canonical/rendering مشاهده شده است.
- **WARN:** هدف اصلی برقرار است، ولی hardening یا پوشش تکمیلی لازم است.
- **NOT TESTED:** ابزار یا محیط لازم در دسترس/پایدار نبوده یا اجرای تست باعث تغییر داده تجاری می‌شده است.

روش‌های استفاده‌شده:

1. دریافت پاسخ خام HTTP و HTML اولیه با `curl` بدون اجرای JavaScript.
2. استخراج Meta Robots، canonical، `og:url`، Title، H1 و JSON-LD از HTML اولیه.
3. دانلود و شمارش تمام Sitemapها.
4. درخواست read-only تمام URLهای Sitemap برای status، redirect، noindex و canonical.
5. مقایسه HTML اولیه مقاله با داده API عمومی همان مقاله.
6. تلاش برای رندر با Chrome Headless و ثبت صریح نتیجه ناموفق.
7. Build و تست regression روی Working Tree محلی.

## Root Causes

### 1. Rendering و canonical مقاله

مسیر مقاله در نسخه Production ابتدا قالب ثابت `articles/detail` را تحویل می‌دهد. قالب شامل داده عمومی زیر است:

```text
canonical=https://orenza.ir/articles/detail/
title=مقاله مجله قهوه اورنزا | اورنزا
h1=در حال دریافت مقاله…
articleBody=""
```

سپس `article-detail.ts` مقاله را از API می‌گیرد و DOM/Meta را در مرورگر تغییر می‌دهد. در نتیجه crawler یا مصرف‌کننده‌ای که HTML اولیه را مبنا قرار دهد، صفحه مستقل مقاله را نمی‌بیند.

### 2. وضعیت noindex

- `robots_index` و `robots_follow` در دیتابیس وجود داشتند و API/route آن‌ها را مستقیماً مصرف می‌کرد.
- این دو فیلد در فرم مدیریت محصولات، دسته‌بندی‌ها، مقاله‌ها و Tagها نمایش داده نمی‌شدند؛ بنابراین تشخیص و اصلاح مقدار ذخیره‌شده شفاف نبود.
- یک guard در Repository هر رکوردی را که قبلاً `robotsIndex=true` داشت مجدداً true می‌کرد. این رفتار از reset تصادفی جلوگیری می‌کرد، اما تغییر عمدی به noindex را نیز ناممکن می‌ساخت.
- برای صفحات عمومی static، Meta Robots به‌صورت پیش‌فرض index است. وقتی global indexing خاموش می‌شد، کنترل نهایی از تنظیمات سایت و `X-Robots-Tag` می‌آمد.

در سه مقاله Production بررسی‌شده، API مقدار `robotsIndex=true` و `robotsFollow=true` برگرداند؛ بنابراین مشکل جاری آن سه URL، **noindex رکورد نیست**، بلکه rendering/canonical و حذف از Sitemap است.

### 3. Sitemap مقالات

تنظیم `sitemapArticlesEnabled` در Production خاموش است. شواهد:

```text
/api/v1/articles?limit=24&page=1 => total=6
/sitemap/sitemap-articles.xml    => 0 URL
/sitemap/sitemap-blogs.xml       => 0 URL
/sitemap.xml                     => فاقد Sitemap مقالات
```

### 4. دسته‌بندی‌ها و Tagهای پویا

- فقط سه دسته‌بندی `coffee-blends`، `cafe-drinks` و `herbal-tea` خروجی Static اختصاصی داشتند.
- دسته‌بندی‌های دیگر از `category-template` استفاده می‌کردند و canonical آن‌ها در HTML اولیه به `/category-template/` اشاره می‌کرد.
- تمام Tagها از `tags/detail` استفاده می‌کردند و canonical اولیه آن‌ها `/tags/detail/` بود.
- endpointهای نامعتبر Tag نیز پیش از اصلاح می‌توانستند قالب عمومی را با HTTP 200 تحویل دهند و خطا را فقط پس از JavaScript نشان دهند.

## Files Changed

| فایل | دلیل تغییر |
|---|---|
| `backend/src/article-page.ts` | renderer سروری مقاله، canonical، robots، BlogPosting، Breadcrumb و hydration data |
| `backend/src/content-page.ts` | renderer سروری دسته‌بندی‌های دیتابیسی و Tagها |
| `backend/src/product-page.ts` | هم‌راستاسازی Meta Robots محصول با وضعیت دیتابیس |
| `backend/src/store/routes.ts` | SSR مقاله/دسته‌بندی/Tag، HTTP status صحیح، فیلتر canonical و کیفیت Sitemap |
| `backend/src/admin/repository.ts` | حذف guardی که تغییر عمدی indexability را خنثی می‌کرد |
| `backend/src/admin/routes.ts` | ثبت تغییرات robots/canonical/slug/redirect در Audit Log |
| `backend/src/migrate.ts` | migration یک‌باره برای فعال‌سازی Sitemap مقاله بدون بازنویسی انتخاب‌های آینده |
| `src/pages/articles/detail.astro` | placeholderهای کنترل‌شده برای HTML واقعی مقاله در SSR |
| `src/scripts/article-detail.ts` | استفاده از hydration اولیه و هماهنگی canonical/Schema پس از hydration |
| `src/pages/payment-result.astro` | افزودن noindex صریح به صفحه تراکنشی |
| `src/admin/resources.ts` | افزودن فیلدهای Robots Index/Follow به منابع عمومی |
| `src/components/admin/AdminResourceForm.astro` | نمایش robots در بخش SEO فرم |
| `src/components/admin/AdminFieldControl.astro` | Help text و هشدار معنایی برای canonical/robots |
| `src/scripts/admin.ts` | confirmation برای انتشار محتوای عمومی با noindex |
| `nginx.conf` | HTTP noindex برای صفحات خصوصی و routing سروری مقاله/دسته‌بندی/Tag |
| `package.json` | افزودن دستور `test:seo` |
| `tests/seo-regression.mjs` | تست indexability، canonical، SSR، robots و 404 templateها |
| `ORENZA_SEO_VALIDATION_REPORT.md` | همین گزارش اعتبارسنجی |

## Production URL Audit

### جدول نتایج

علامت `—` برای `X-Robots-Tag` به معنی نبود header است؛ نبود header روی صفحه عمومی به‌تنهایی مانع indexability نیست.

| URL | HTTP | Meta Robots | X-Robots | Canonical | Title / H1 در HTML اولیه | محتوای اصلی اولیه | نتیجه |
|---|---:|---|---|---|---|---|---|
| `https://orenza.ir/` | 200 | index, follow | — | self | اختصاصی / «کیفیت، اتفاقی نیست.» | بله | **PASS** |
| `/products/masala-chai/` | 200 | index, follow | index, follow | self | اختصاصی / «چای ماسالا» | عنوان، توضیح، وضعیت موجودی و hydration data موجود؛ متن editorial کامل client-side | **PASS / WARN** |
| `/products/kerak-tea/` | 200 | index, follow | index, follow | self | اختصاصی / «چای کرک» | عنوان، توضیح و وضعیت «ناموجود» موجود؛ متن editorial کامل client-side | **PASS / WARN** |
| `/products/100-robusta/` | 200 | index, follow | index, follow | self | اختصاصی / «قهوه ۱۰۰٪ روبوستا» | عنوان، توضیح، وضعیت موجودی و hydration data موجود؛ متن editorial کامل client-side | **PASS / WARN** |
| `/articles/ganoderma-coffee-guide/` | 200 | index, follow | — | **`/articles/detail/`** | عمومی / «در حال دریافت مقاله…» | خیر؛ `articleBody` خالی | **FAIL** |
| `/articles/decaf-coffee-guide/` | 200 | index, follow | — | **`/articles/detail/`** | عمومی / «در حال دریافت مقاله…» | خیر؛ `articleBody` خالی | **FAIL** |
| `/articles/arabica-vs-robusta/` | 200 | index, follow | — | **`/articles/detail/`** | عمومی / «در حال دریافت مقاله…» | خیر؛ `articleBody` خالی | **FAIL** |
| `/category/coffee-blends/` | 200 | index, follow | — | self | اختصاصی / «قهوه» | متن Static موجود؛ محصولات client-side | **PASS / WARN** |
| `/category/cafe-drinks/` | 200 | index, follow | — | self | اختصاصی / «نوشیدنی‌های پودری» | متن Static موجود؛ محصولات client-side | **PASS / WARN** |
| `/category/herbal-tea/` | 200 | index, follow | — | self | اختصاصی / «دمنوش» | متن Static موجود؛ محصولات client-side | **PASS / WARN** |
| `/tags/buy-coffee/` | 200 | index, follow | — | **`/tags/detail/`** | عمومی / «در حال دریافت برچسب…» | خیر | **FAIL** |
| `/account/profile/` | 200 | noindex, nofollow | — | self | اختصاصی / «حساب کاربری» | بله، shell حساب | **PASS هدف خصوصی / WARN header** |

### دستور نمونه و خروجی واقعی Production

```bash
curl -sS -D headers.txt https://orenza.ir/articles/ganoderma-coffee-guide/ -o article.html
rg -o '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>|<title>[^<]*</title>|<h1[^>]*>[^<]*</h1>' article.html
```

خروجی واقعی:

```text
HTTP/1.1 200 OK
X-Robots-Tag: ABSENT
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://orenza.ir/articles/detail/">
<title>مقاله مجله قهوه اورنزا | اورنزا</title>
<h1 ...>در حال دریافت مقاله…</h1>
```

مقایسه با API همان مقاله:

```bash
curl -sS https://orenza.ir/api/v1/articles/ganoderma-coffee-guide
```

خلاصه خروجی واقعی:

```json
{
  "slug": "ganoderma-coffee-guide",
  "robotsIndex": true,
  "robotsFollow": true,
  "canonicalUrl": null,
  "contentLength": 15897
}
```

دو مقاله دیگر نیز در API محتوای واقعی دارند:

```text
decaf-coffee-guide: contentLength=13893, robotsIndex=true
arabica-vs-robusta: contentLength=16141, robotsIndex=true
```

این اختلاف اثبات می‌کند محتوا در داده منبع وجود دارد، اما در HTML اولیه Production قرار نگرفته است.

نمونه محصول:

```text
GET /products/masala-chai/ => 200
X-Robots-Tag: index, follow
canonical: https://orenza.ir/products/masala-chai/
title: خرید چای ماسالا | قیمت و مشخصات نوشیدنی ادویه‌ای | Orenza | اورنزا
h1: چای ماسالا
description in initial HTML: گرم، ادویه‌ای و معطر ...
```

## Robots & Sitemap Audit — Production

### robots.txt

```bash
curl -sS -D - https://orenza.ir/robots.txt
```

خروجی مهم:

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
User-agent: *
Allow: /
Allow: /_assets/
Allow: /images/
Allow: /api/v1/product-images/
Disallow: /admin/
Disallow: /account/
Disallow: /login/
Disallow: /checkout/
Disallow: /payment-result/
Disallow: /api/
Sitemap: https://orenza.ir/sitemap.xml
```

نتیجه:

- مسیرهای محصول، مقاله، دسته‌بندی و Tag مسدود نشده‌اند: **PASS**.
- CSS، JavaScript و تصاویر عمومی مسدود نشده‌اند: **PASS**.
- مسیرهای خصوصی/مدیریتی و پارامترهای جست‌وجو/فیلتر مسدودند: **PASS**.
- Sitemap Index معرفی شده است: **PASS**.
- `Allow: /api/v1/product-images/` از `Disallow: /api/` خاص‌تر است و برای Googlebot قابل استفاده است.
- robots.txt ابزار امنیتی نیست؛ حفاظت واقعی صفحات خصوصی همچنان باید authentication/authorization باشد.

### Sitemapها

| Sitemap | HTTP | تعداد URL | قابل ایندکس سالم در ممیزی | noindex | Redirect | HTTP error نهایی | non-canonical |
|---|---:|---:|---:|---:|---:|---:|---:|
| `sitemap-statics.xml` | 200 | 8 | 8 | 0 | 0 | 0 | 0 |
| `sitemap-products.xml` | 200 | 23 | 23 | 0 | 0 | 0 | 0 |
| `sitemap-categories.xml` | 200 | 7 | 3 | 0 | 0 | 0 | 4 |
| `sitemap-tags.xml` | 200 | 20 | 0 | 0 | 0 | 0 تأییدشده | 20 |
| `sitemap-articles.xml` | 200 | 0 | 0 | 0 | 0 | 0 | 0 |
| `sitemap-blogs.xml` | 200 | 0 | 0 | 0 | 0 | 0 | 0 |
| **جمع URLهای معرفی‌شده** | — | **58** | **34** | **0** | **0** | **0 تأییدشده** | **24** |

یادداشت پایداری HTTP: در sweep ترتیبی ۵۸ URL، `tags/buy-coffee-online/` یک بار 500 برگرداند، اما بازآزمایی منفرد نهایی آن 200 بود. بنابراین خطای قطعی فعلی شمرده نشده، ولی رفتار transient 500 یک **WARN عملیاتی** است و باید در لاگ Nginx/API بررسی شود.

Sitemap Index فعلی:

```text
https://orenza.ir/sitemap/sitemap-statics.xml
https://orenza.ir/sitemap/sitemap-products.xml
https://orenza.ir/sitemap/sitemap-categories.xml
https://orenza.ir/sitemap/sitemap-tags.xml
```

Sitemap مقاله در Index وجود ندارد: **FAIL**.

چهار دسته‌بندی non-canonical فعلی:

```text
/category/coffee/
/category/instant-coffee/
/category/brewed-coffee/
/category/organic-products/
canonical مشترک: https://orenza.ir/category-template/
```

تمام ۲۰ Tag به `https://orenza.ir/tags/detail/` canonical می‌شوند: **FAIL**.

### تطابق محتوای واقعی با Sitemap

- سه محصول نمونه در Sitemap محصول حضور دارند: **PASS**.
- سه دسته‌بندی اصلی نمونه در Sitemap دسته‌بندی حضور دارند: **PASS**.
- سه مقاله نمونه منتشرشده در Sitemap مقاله حضور ندارند: **FAIL**.
- API عمومی ۶ مقاله منتشرشده برمی‌گرداند، اما Sitemap مقاله صفر URL دارد: **FAIL**.
- Tag نمونه در Sitemap حضور دارد، ولی self-canonical نیست: **FAIL**.

## Canonical & Indexability Audit

### Production

- صفحه اصلی: canonical، `og:url` و WebPage URL هم‌راستا: **PASS**.
- محصولات نمونه: canonical، `og:url` و WebPage URL هم‌راستا: **PASS**.
- مقالات نمونه: canonical و WebPage URL هر دو به template عمومی اشاره دارند؛ URL واقعی مقاله مستقل نیست: **FAIL**.
- سه دسته‌بندی Static نمونه: self-canonical: **PASS**.
- چهار دسته‌بندی دیتابیسی دیگر: canonical عمومی template: **FAIL**.
- تمام Tagها: canonical عمومی template: **FAIL**.
- حساب کاربری: Meta noindex دارد و در robots.txt Disallow شده، ولی X-Robots-Tag ندارد: **PASS برای exclusion، WARN برای hardening**.

### Local اصلاح‌شده، قبل از Deploy

- rendererهای مقاله، محصول، دسته‌بندی و Tag canonical را از URL نهایی یا canonical صریح مدیر تولید می‌کنند.
- canonical، `og:url`، alternate و شناسه WebPage/BlogPosting هم‌راستا می‌شوند.
- URL دارای canonical متفاوت از URL جاری از Sitemap حذف می‌شود.
- صفحات عمومی جدید به‌صورت پیش‌فرض `index, follow` هستند.
- صفحات خصوصی در Nginx جدید `X-Robots-Tag: noindex, nofollow, noarchive` دریافت می‌کنند.
- این موارد در Production **هنوز تأیید نشده‌اند**.

## Structured Data Audit

### Production: انواع مشاهده‌شده در HTML اولیه

| نوع صفحه | Schemaهای مشاهده‌شده | نتیجه |
|---|---|---|
| صفحه اصلی | `Organization`, `WebSite`, `WebPage` | **PASS** |
| محصولات نمونه | `Organization`, `WebSite`, `WebPage`, `BreadcrumbList` | **FAIL: Product/Offer غایب** |
| مقالات نمونه | `Organization`, `WebSite`, `WebPage` با URL template | **FAIL: BlogPosting در HTML اولیه غایب و WebPage URL اشتباه** |
| دسته‌بندی‌های Static نمونه | `Organization`, `WebSite`, `WebPage`, `BreadcrumbList` | **PASS** |
| Tag نمونه | `Organization`, `WebSite`, `WebPage`, `BreadcrumbList` | **FAIL: URL و breadcrumb عمومی/اشتباه** |
| حساب کاربری | Schema عمومی تولید نمی‌شود چون noindex است | **PASS** |

### Product و Offer

هیچ `Product` یا `Offer` در HTML اولیه سه محصول نمونه یافت نشد. این محصولات عنوان، موجودی و داده قیمت دارند و در صورت عرضه عمومی می‌توانند واجد Product/Offer باشند، اما Schema باید فقط از داده واقعی همان محصول تولید شود؛ قیمت، currency و availability نباید حدس زده شوند.

نتیجه: **FAIL / Remaining Issue**.

### Article / BlogPosting

در HTML اولیه Production وجود ندارد. JavaScript فعلی تلاش می‌کند BlogPosting را پس از fetch اضافه کند، اما WebPage اولیه همچنان به `/articles/detail/` اشاره دارد و برای مصرف‌کننده بدون JS نامعتبر است.

در Local جدید BlogPosting، WebPage و Breadcrumb با canonical نهایی تولید و توسط تست renderer اعتبارسنجی شده‌اند؛ تأیید Production منوط به Deploy است.

### داده تکراری یا نامعتبر

- محصولات دو block دارند: graph اصلی و Breadcrumb؛ نوع تکراری ناسازگار مشاهده نشد.
- مقاله Production پس از JavaScript بالقوه یک BlogPosting جدید کنار WebPage template اضافه می‌کند؛ به علت عدم موفقیت تست مرورگر، DOM نهایی به‌صورت مستقیم تأیید نشد، اما HTML اولیه قطعاً URL اشتباه دارد.
- Tag Production دارای Breadcrumb عمومی با مقصد نهایی `/products/` برای آیتم «برچسب» است و WebPage آن `/tags/detail/` است: **FAIL**.
- اطلاعات ساختگی برای تکمیل Schema در این گزارش تولید نشده است.

## Rendering Audit

### مقایسه HTML اولیه و منبع داده

| صفحه | HTML اولیه curl | داده واقعی/API | نتیجه |
|---|---|---|---|
| محصول چای ماسالا | Title/H1/description/canonical واقعی | hydration JSON نیز موجود | SSR پایه **PASS**؛ محتوای editorial کامل client-side |
| مقاله گانودرما | template عمومی، بدنه خالی | API دارای ۱۵٬۸۹۷ کاراکتر content | **FAIL** |
| مقاله دی‌کف | template عمومی، بدنه خالی | API دارای ۱۳٬۸۹۳ کاراکتر content | **FAIL** |
| مقاله عربیکا/روبوستا | template عمومی، بدنه خالی | API دارای ۱۶٬۱۴۱ کاراکتر content | **FAIL** |
| دسته‌بندی‌های سه‌گانه | H1 و متن Static واقعی | محصولات از API اضافه می‌شوند | **PASS / WARN** |
| Tag خرید قهوه | H1 موقت و content خالی | داده پس از API/JS بارگذاری می‌شود | **FAIL** |

### تست مرورگر واقعی Production

دستور استفاده‌شده:

```bash
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new --disable-gpu --no-first-run \
  --virtual-time-budget=5000 --dump-dom \
  https://orenza.ir/articles/ganoderma-coffee-guide/
```

خروجی چهار اجرای اولیه برای مقاله، محصول، دسته‌بندی و Tag:

```text
title=500 Internal Server Error
h1=500 Internal Server Error
document size=176 bytes
```

همان URLهای محصول و مقاله بلافاصله با curl وضعیت 200 دادند. اجرای مجدد Chrome با User-Agent معمول نیز DOM قابل استفاده تولید نکرد و فایل خروجی صفر بایت بود.

نتیجه تست DOM پس از JavaScript: **NOT TESTED**.  
نتیجه HTML اولیه بدون JavaScript: طبق جدول بالا قطعی و قابل تکرار است.

## Local Validation — Not Production

### Build و Regression

دستور:

```bash
npm run test:seo
```

خروجی واقعی خلاصه‌شده:

```text
Astro check: 0 errors, 0 warnings, 6 hints
Astro build: 83 pages built successfully
Backend: tsc -p tsconfig.json => success

tests 7
pass 7
fail 0
```

تست‌های عبوری:

```text
✔ public static pages are indexable and self canonical in initial HTML
✔ private and transactional pages are noindex
✔ robots.txt protects private routes without blocking public content or assets
✔ nginx preserves 404s for non-public templates and sends HTTP noindex on private routes
✔ article renderer emits server-visible content and aligned SEO URLs
✔ product renderer keeps meta robots aligned with an intentional noindex
✔ dynamic category and tag renderers emit initial H1, content and self canonicals
```

بررسی whitespace/diff:

```bash
git diff --check
```

خروجی: خالی، یعنی خطای whitespace گزارش نشد.

### پوشش Commerce

فایل‌های زیر در اصلاح SEO تغییر نکرده‌اند:

```text
src/scripts/product-detail.ts
src/scripts/cart.ts
backend/src/store/order-service.ts
```

بنابراین منطق انتخاب وزن، محاسبه قیمت، local cart و ثبت سفارش مستقیماً ویرایش نشده است. بااین‌حال:

- تست E2E انتخاب وزن: **NOT TESTED**.
- تست E2E افزودن به سبد: **NOT TESTED**.
- تست E2E Checkout و ثبت سفارش: **NOT TESTED**؛ عمداً سفارش آزمایشی روی Production ایجاد نشد.
- تست پرداخت واقعی: **NOT TESTED**.
- Build موفق فقط عدم شکست compile/bundle را ثابت می‌کند و جایگزین E2E commerce نیست.

در نتیجه نمی‌توان پیش از اجرای smoke test روی Staging تأیید قطعی داد که رفتار تجاری آسیب ندیده است؛ فقط می‌توان تأیید کرد فایل‌های اصلی commerce دست‌نخورده‌اند و build موفق است.

## Remaining Issues

1. **اصلاحات هنوز Deploy نشده‌اند.** تمام FAILهای Production مربوط به نسخه زنده فعلی‌اند.
2. Product/Offer schema در محصول وجود ندارد؛ این مورد در patch فعلی نیز هنوز پیاده‌سازی نشده است.
3. فهرست کارت‌های صفحه محصولات و مقالات و بخشی از محصولات مرتبط همچنان client-rendered است.
4. محتوای editorial کامل محصول در HTML اولیه خالی است و پس از hydration درج می‌شود؛ فقط عنوان، توضیح کوتاه و مشخصات پایه SSR هستند.
5. E2E خرید، Checkout و پرداخت انجام نشده است.
6. migration و queryهای Sitemap با دیتابیس واقعی Staging اجرا نشده‌اند؛ تست فعلی renderer/unit/build است.
7. رفتار 500 در Chrome Headless و 500 transient طی sweep نیازمند بررسی لاگ Nginx/API است.
8. هشدارهای Build موجود، ۶ hint قدیمی مربوط به iconهای deprecated و importهای استفاده‌نشده‌اند؛ خطای build نیستند.
9. `lastmod` از `updated_at` می‌آید؛ اگر ویرایش‌های غیرمحتوایی همان ستون را تغییر دهند، هنوز ممکن است lastmod بیش از حد به‌روزرسانی شود.
10. هیچ تضمینی درباره ایندکس قطعی Google داده نمی‌شود.

## Recommended Next Actions

### قبل از Deploy

1. اجرای compose کامل روی Staging همراه PostgreSQL و Nginx.
2. اجرای migration و بررسی اینکه `sitemapArticlesEnabled` فقط یک بار true می‌شود.
3. اجرای `npm run test:seo` در CI.
4. smoke test دستی/خودکار انتخاب وزن، قیمت، افزودن به سبد، login، Checkout و ثبت یک سفارش آزمایشی در Staging.
5. افزودن Product/Offer JSON-LD از داده واقعی محصول شامل currency، price و availability؛ بدون مقدار ساختگی.
6. اجرای Schema Validator/Rich Results Test روی خروجی Staging.

### بلافاصله پس از Deploy

```bash
curl -sS -D - https://orenza.ir/articles/ganoderma-coffee-guide/
curl -sS https://orenza.ir/articles/ganoderma-coffee-guide/ | rg 'canonical|og:url|robots|BlogPosting|<h1|data-article-content'
curl -sS https://orenza.ir/sitemap.xml
curl -sS https://orenza.ir/sitemap/sitemap-articles.xml
curl -sS -D - https://orenza.ir/tags/buy-coffee/
curl -sS -D - https://orenza.ir/category/organic-products/
curl -sS -D - https://orenza.ir/account/profile/
```

انتظار بعد از Deploy:

- مقاله: self-canonical، Title/H1/content واقعی، BlogPosting و `X-Robots-Tag: index, follow`.
- Tag و دسته‌بندی پویا: self-canonical و محتوای واقعی در HTML اولیه.
- حساب: Meta و HTTP header هر دو noindex.
- Sitemap مقاله: شامل تمام مقاله‌های published + indexable + canonical.
- Sitemapها: فاقد redirect، 404، 5xx، noindex و non-canonical.

### Google Search Console

1. Submit مجدد `https://orenza.ir/sitemap.xml`.
2. URL Inspection برای سه مقاله نمونه و انتخاب `Test Live URL`.
3. بررسی `User-declared canonical` و `Google-selected canonical`.
4. Request Indexing فقط برای URLهای اولویت‌دار.
5. پایش Page Indexing، Duplicate/Alternate canonical و Crawled/Discovered currently not indexed برای ۲ تا ۴ هفته.
6. بررسی Crawl Stats برای spike در 5xx پس از Deploy.

## Final Assessment

| محیط | نتیجه |
|---|---|
| Production فعلی | **FAIL** برای مقاله، Tag، ۴ دسته‌بندی پویا و Sitemap مقاله؛ **PASS** برای صفحه اصلی و محصولات نمونه |
| Local patch | **PASS** در build و ۷ تست SEO؛ نیازمند Staging/Deploy validation |
| Structured Data | **FAIL** تا زمان افزودن Product/Offer و تأیید زنده BlogPosting |
| Commerce regression | **NOT TESTED** به‌صورت E2E |
| آمادگی برای Deploy | مشروط به Staging DB/Nginx test و commerce smoke test |

