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

## راه‌اندازی پنل مدیریت

پنل در مسیر `/admin/` قرار دارد و با همان session امن حساب‌های کاربری کار
می‌کند. دسترسی APIهای مدیریت فقط برای کاربر دارای نقش `admin` باز است.

در فایل `.env` این سه مقدار را وارد کنید:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=یک-رمز-طولانی-و-تصادفی
ADMIN_NAME=مدیر اورنزا
```

سپس بعد از ساخت کانتینرها، حساب مدیر را یک‌بار ایجاد یا به‌روزرسانی کنید:

```bash
docker compose exec api node dist/create-admin.js
```

پس از ورود، ترتیب آماده‌سازی فروشگاه:

1. بررسی دسته‌بندی پیش‌فرض یا ساخت دسته‌بندی تازه
2. ثبت محصولات و قیمت چهار وزن
3. ثبت و فعال‌کردن اطلاعات کارت‌به‌کارت
4. ساخت کدهای تخفیف در صورت نیاز
5. انجام یک سفارش آزمایشی از `/order/`

صفحات پنل `noindex` هستند و در sitemap قرار نمی‌گیرند.

## اعلان سفارش جدید

پس از ثبت موفق سفارش، API بدون معطل‌کردن پاسخ مشتری، اعلان ایمیل و تلگرام را
ارسال می‌کند. نبودن یا قطع‌بودن هر سرویس باعث لغو سفارش نمی‌شود.

برای ایمیل، تنظیمات SMTP را در `.env` وارد کنید. در Gmail باید تأیید دومرحله‌ای
فعال و به‌جای رمز اصلی حساب، App Password استفاده شود:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=order.orenzacoffee@gmail.com
SMTP_PASS=
SMTP_FROM=Orenza Orders <order.orenzacoffee@gmail.com>
ORDER_NOTIFICATION_EMAIL=order.orenzacoffee@gmail.com
```

برای تلگرام، Bot را با BotFather بسازید، آن را مدیر کانال سفارش‌ها کنید و سپس
این دو مقدار را وارد کنید. شناسه کانال می‌تواند نام عمومی مانند
`@orenza_orders` یا شناسه عددی کانال باشد:

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_ORDER_CHAT_ID=
```
