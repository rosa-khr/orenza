# Orenza Coffee

وب‌سایت استاتیک برند قهوه Orenza، ساخته‌شده با Astro و TypeScript.

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
docker compose up --build
```

سایت روی `http://localhost:8080` در دسترس خواهد بود.

در شبکه ASAX، Compose فایل محلی `.asax-ca.pem` را به‌صورت BuildKit secret
به مرحله build می‌دهد. این فایل وارد image یا Git نمی‌شود.

برای استفاده از CA دیگری، فایل `.asax-ca.pem` را با CA معتبر همان شبکه جایگزین
کنید؛ اعتبارسنجی SSL را غیرفعال نکنید. بیلد مستقیم بدون Compose:

```bash
docker build --secret id=npm_ca,src=company-ca.pem -t orenza-coffee .
```

## محدوده نسخه فعلی

- صفحه معرفی برند
- انتخاب ترکیب قهوه
- انتخاب درجه رست
- انتخاب دان یا آسیاب‌شده
- انتخاب دستگاه و درجه آسیاب مرتبط
- انتخاب وزن و نمایش خلاصه

سبد خرید، قیمت‌گذاری و ارسال سفارش در فاز فروشگاه اضافه می‌شود.
