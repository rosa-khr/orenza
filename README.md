# Orenza Coffee

فروشگاه قهوه Orenza با فرانت‌اند Astro، API تایپ‌اسکریپت و PostgreSQL.

## اجرای محلی

```bash
npm install
npm run dev
```

## ساخت نسخه نهایی

```bash
npm run build
```

خروجی استاتیک در پوشه `dist` ساخته می‌شود.

## اجرا با Docker

```bash
cp .env.example .env
docker compose up -d --build
```

سایت روی `http://localhost:8080` در دسترس خواهد بود.

بررسی وضعیت کانتینر:

```bash
docker compose ps
curl -I http://127.0.0.1:8080/
```

## انتشار روی هاست

از زمان اضافه‌شدن حساب کاربری، آپلود پوشه `dist` به‌تنهایی کافی نیست؛ آن روش
فقط صفحات عمومی را نمایش می‌دهد و API، ورود و ذخیره نشانی کار نمی‌کنند.

### سرور لینوکسی با Docker

```bash
git pull
cp .env.example .env
# مقادیر امن production را در .env وارد کنید
docker compose up -d --build
```

پورت `8080` را مستقیماً عمومی نکنید؛ Nginx یا Caddy میزبان را به
`127.0.0.1:8080` متصل و HTTPS را برای دامنه فعال کنید.

در production حتماً `POSTGRES_PASSWORD` را تصادفی و طولانی، `APP_ORIGIN` را
`https://orenza.ir` و `COOKIE_SECURE` را `true` قرار دهید.

## محدوده نسخه فعلی

- صفحه معرفی برند
- انتخاب ترکیب قهوه
- انتخاب درجه رست
- انتخاب دان یا آسیاب‌شده
- انتخاب دستگاه و درجه آسیاب مرتبط
- انتخاب وزن و نمایش خلاصه
- سبد سفارش و دریافت کامل نشانی
- انتخاب ارسال با تیپاکس یا پست
- انتخاب پرداخت کارت‌به‌کارت
- ارسال خلاصه سفارش در واتساپ یا بله
- ورود با موبایل و رمز عبور
- ورود گوگل پس از تنظیم Client ID
- پروفایل، چند نشانی و تغییر رمز

درگاه و قیمت‌گذاری آنلاین در این نسخه وجود ندارد؛ مبلغ نهایی، هزینه ارسال و
اطلاعات کارت پس از بررسی سفارش در پیام‌رسان اعلام می‌شود.

## SEO و ثبت در Search Console

- فایل robots: `https://orenza.ir/robots.txt`
- نقشه سایت: `https://orenza.ir/sitemap-index.xml`
- صفحات ناشناخته و مسیرهای رایج اسکن با پاسخ 404 و `noindex` بسته می‌شوند.
- پس از هر انتشار، ابتدا پاسخ صفحه اصلی و نقشه سایت را بررسی کنید؛ سپس
  `sitemap-index.xml` را در بخش Sitemaps سرچ کنسول ثبت کنید.

## تست حساب کاربری

```bash
npm run typecheck --prefix backend
npm run test:account --prefix backend
```

نقشه فازهای فروشگاه و تنظیم ورود گوگل در
[`docs/commerce-roadmap.md`](docs/commerce-roadmap.md) ثبت شده است.
