export type AdminFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "date"
  | "image"
  | "permissions";

export type AdminField = {
  key: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  min?: number;
  maxLength?: number;
  options?: { label: string; value: string }[];
  list?: boolean;
  readonly?: boolean;
  dir?: "rtl" | "ltr";
};

export type AdminResource = {
  key: string;
  title: string;
  singular: string;
  description: string;
  fields: AdminField[];
  readonly?: boolean;
  canCreate?: boolean;
  navHidden?: boolean;
};

const yesNo = [
  { label: "فعال", value: "true" },
  { label: "غیرفعال", value: "false" }
];

const adminPermissions = [
  { label: "داشبورد", value: "dashboard" },
  { label: "کاربران", value: "users" },
  { label: "نقش‌ها و دسترسی‌ها", value: "roles" },
  { label: "محصولات", value: "products" },
  { label: "دسته‌بندی‌ها", value: "categories" },
  { label: "سفارش‌ها", value: "orders" },
  { label: "روش‌های پرداخت", value: "payment-methods" },
  { label: "روش‌های ارسال", value: "shipping-methods" },
  { label: "کدهای تخفیف", value: "discount-codes" },
  { label: "مقالات", value: "articles" },
  { label: "تگ‌ها", value: "tags" },
  { label: "تنظیمات سایت", value: "site-settings" },
  { label: "گزارش لاگ‌ها", value: "logs" },
  { label: "محتوام", value: "content-generator" },
  { label: "حسابداری", value: "accounting" },
  { label: "به‌روزرسانی قیمت خرید", value: "price-imports" }
];

export const iranianBanks = [
  { name: "ملی ایران", code: "bmi" },
  { name: "ملت", code: "mellat" },
  { name: "تجارت", code: "tejarat" },
  { name: "صادرات ایران", code: "bsi" },
  { name: "سپه", code: "sepah" },
  { name: "کشاورزی", code: "bki" },
  { name: "مسکن", code: "maskan" },
  { name: "رفاه کارگران", code: "rb" },
  { name: "پاسارگاد", code: "bpi" },
  { name: "پارسیان", code: "parsian" },
  { name: "سامان", code: "sb" },
  { name: "اقتصاد نوین", code: "en" },
  { name: "شهر", code: "shahr" },
  { name: "آینده", code: "ba" },
  { name: "دی", code: "day" },
  { name: "کارآفرین", code: "kar" },
  { name: "خاورمیانه", code: "me" },
  { name: "گردشگری", code: "tourism" },
  { name: "ایران‌زمین", code: "iz" },
  { name: "رسالت", code: "resalat" }
].map((bank) => ({ label: `بانک ${bank.name}`, value: bank.name, code: bank.code }));

export const adminResources: AdminResource[] = [
  {
    key: "users",
    title: "کاربران",
    singular: "کاربر",
    description: "مشخصات، سطح دسترسی و امنیت حساب‌های فروشگاه",
    canCreate: false,
    fields: [
      { key: "firstName", label: "نام", type: "text", required: true, list: true },
      { key: "lastName", label: "نام خانوادگی", type: "text", required: true, list: true },
      { key: "phone", label: "شماره موبایل", type: "text", dir: "ltr", readonly: true, list: true },
      { key: "email", label: "ایمیل", type: "text", dir: "ltr", readonly: true, list: true },
      { key: "username", label: "نام کاربری مدیریت", type: "text", dir: "ltr", readonly: true },
      {
        key: "role",
        label: "سطح دسترسی",
        type: "select",
        readonly: true,
        list: true,
        options: [
          { label: "کاربر فروشگاه", value: "customer" },
          { label: "مدیر", value: "admin" }
        ]
      },
      { key: "panelRoleTitle", label: "نقش پنل", type: "text", readonly: true, list: true },
      {
        key: "hasPassword",
        label: "رمز عبور",
        type: "select",
        readonly: true,
        list: true,
        options: [
          { label: "تنظیم شده", value: "true" },
          { label: "تنظیم نشده", value: "false" }
        ]
      },
      { key: "lastLoginAt", label: "آخرین ورود", type: "text", readonly: true, list: true },
      { key: "createdAt", label: "تاریخ عضویت", type: "text", readonly: true, list: true }
    ]
  },
  {
    key: "roles",
    title: "نقش‌ها و دسترسی‌ها",
    singular: "نقش",
    description: "تعریف نقش‌های پنل و تعیین منوهای قابل دسترس",
    fields: [
      { key: "title", label: "عنوان نقش", type: "text", required: true, list: true },
      { key: "slug", label: "شناسه نقش", type: "text", required: true, dir: "ltr", list: true },
      {
        key: "permissions",
        label: "دسترسی منوها",
        type: "permissions",
        required: true,
        options: adminPermissions
      },
      {
        key: "isSystem",
        label: "نوع نقش",
        type: "select",
        readonly: true,
        list: true,
        options: [
          { label: "سیستمی", value: "true" },
          { label: "سفارشی", value: "false" }
        ]
      },
      { key: "isActive", label: "وضعیت", type: "select", required: true, options: yesNo, list: true }
    ]
  },
  {
    key: "service-scripts",
    title: "اسکریپت‌های سرویس",
    singular: "اسکریپت سرویس",
    description: "مدیریت امن سرویس‌های تحلیل، تگ منیجر و تأیید مالکیت",
    navHidden: true,
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      {
        key: "provider",
        label: "سرویس",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "Google Tag Manager", value: "gtm" },
          { label: "Google Analytics 4", value: "ga4" },
          { label: "Google Search Console", value: "searchConsole" }
        ]
      },
      { key: "serviceKey", label: "شناسه سرویس", type: "text", required: true, dir: "ltr", list: true },
      {
        key: "placement",
        label: "محل بارگذاری",
        type: "select",
        required: true,
        options: [
          { label: "داخل Head", value: "head" },
          { label: "ابتدای Body", value: "body" }
        ]
      },
      { key: "isActive", label: "وضعیت", type: "select", required: true, options: yesNo, list: true }
    ]
  },
  {
    key: "products",
    title: "محصولات",
    singular: "محصول",
    description: "قهوه‌ها، قیمت هر وزن و وضعیت عرضه",
    fields: [
      { key: "titleFa", label: "عنوان فارسی", type: "text", required: true, list: true },
      { key: "sortOrder", label: "ترتیب نمایش", type: "number", required: true, min: 1, list: true },
      { key: "titleEn", label: "عنوان انگلیسی", type: "text", required: true, dir: "ltr" },
      { key: "categoryId", label: "دسته‌بندی", type: "select", required: true },
      { key: "description", label: "توضیحات و ویژگی‌های فنجان", type: "textarea", required: true },
      { key: "seoTitle", label: "عنوان سئو", type: "text", maxLength: 60 },
      { key: "seoDescription", label: "توضیحات متا", type: "textarea", maxLength: 150 },
      { key: "productContent", label: "محتوای کامل صفحه محصول", type: "richtext" },
      { key: "tagIds", label: "برچسب‌های مرتبط", type: "multiselect" },
      { key: "relatedProductIds", label: "محصولات مرتبط", type: "multiselect" },
      {
        key: "roastType",
        label: "پروفایل رُست",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "روشن", value: "light" },
          { label: "متوسط", value: "medium" },
          { label: "متوسط رو به تیره", value: "mediumDark" },
          { label: "تیره", value: "dark" }
        ]
      },
      {
        key: "coffeeType",
        label: "فرم پیش‌فرض",
        type: "select",
        required: true,
        options: [
          { label: "دان", value: "bean" },
          { label: "آسیاب‌شده", value: "ground" }
        ]
      },
      {
        key: "grindType",
        label: "آسیاب پیش‌فرض",
        type: "select",
        options: [
          { label: "بدون آسیاب", value: "none" },
          { label: "اسپرسو", value: "espresso" },
          { label: "موکاپات", value: "mokaPot" },
          { label: "فرنچ‌پرس", value: "frenchPress" },
          { label: "ترک", value: "turkish" },
          { label: "فیلتری", value: "filter" }
        ]
      },
      { key: "blendType", label: "ترکیب دانه", type: "text", required: true, list: true },
      {
        key: "saleType",
        label: "نوع فروش",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "فروش وزنی", value: "weighted" },
          { label: "فروش بسته‌ای", value: "packaged" }
        ]
      },
      {
        key: "packageWeightGrams",
        label: "وزن ثابت بسته",
        type: "select",
        required: true,
        options: [
          { label: "۲۵۰ گرم", value: "250" },
          { label: "۵۰۰ گرم", value: "500" },
          { label: "۱ کیلوگرم", value: "1000" }
        ]
      },
      {
        key: "stockStatus",
        label: "امکان تأمین",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "موجود", value: "inStock" },
          { label: "ناموجود", value: "outOfStock" }
        ]
      },
      { key: "purchasePricePerKg", label: "قیمت خرید واحد (تومان)", type: "number", required: true, min: 0, list: true },
      { key: "markupPercent", label: "درصد افزایش قیمت", type: "number", min: 0 },
      { key: "salePricePerKg", label: "قیمت فروش واحد (تومان)", type: "number", required: true, min: 0, list: true },
      { key: "profitPerKg", label: "سود واحد (تومان)", type: "number", list: true, readonly: true },
      { key: "imageUrl", label: "تصویر محصول", type: "image", dir: "ltr" },
      { key: "showInBestSellers", label: "نمایش در پرفروش‌ترین‌ها", type: "select", options: yesNo, list: true },
      { key: "showInDiscounts", label: "نمایش در محصولات تخفیف‌دار", type: "select", options: yesNo, list: true },
      { key: "isActive", label: "وضعیت", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "categories",
    title: "دسته‌بندی‌ها",
    singular: "دسته‌بندی",
    description: "ساختار مرتب محصولات فروشگاه",
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      { key: "slug", label: "نامک", type: "text", required: true, dir: "ltr", list: true },
      { key: "parentCategoryId", label: "دسته‌بندی پدر", type: "select" },
      { key: "description", label: "محتوای دسته‌بندی", type: "richtext" },
      { key: "imageUrl", label: "بنر دسته‌بندی", type: "image", dir: "ltr" },
      { key: "seoTitle", label: "عنوان سئو", type: "text", required: true, maxLength: 60 },
      { key: "seoDescription", label: "توضیحات متا", type: "textarea", required: true, maxLength: 150 },
      { key: "showInPopularFooter", label: "نمایش در لینک‌های پربازدید فوتر", type: "select", options: yesNo, list: true },
      { key: "isActive", label: "وضعیت", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "orders",
    title: "سفارش‌ها",
    singular: "سفارش",
    description: "پیگیری پرداخت، آماده‌سازی و ارسال",
    fields: [
      { key: "orderNumber", label: "شماره سفارش", type: "text", list: true },
      { key: "customerName", label: "نام مشتری", type: "text", list: true },
      { key: "customerPhone", label: "شماره تماس", type: "text", dir: "ltr", list: true },
      { key: "customerAddress", label: "نشانی تحویل", type: "textarea" },
      { key: "totalAmount", label: "مبلغ کل", type: "number", list: true },
      { key: "discountAmount", label: "تخفیف", type: "number" },
      { key: "taxAmount", label: "مالیات", type: "number", list: true },
      { key: "finalAmount", label: "مبلغ نهایی", type: "number", list: true },
      { key: "paymentRefId", label: "کد پیگیری واریز", type: "text", dir: "ltr", list: true, readonly: true },
      {
        key: "paymentStatus",
        label: "وضعیت پرداخت",
        type: "select",
        list: true,
        options: [
          { label: "در انتظار", value: "pending" },
          { label: "پرداخت‌شده", value: "paid" },
          { label: "ردشده", value: "rejected" }
        ]
      },
      {
        key: "orderStatus",
        label: "وضعیت سفارش",
        type: "select",
        list: true,
        options: [
          { label: "جدید", value: "new" },
          { label: "در حال آماده‌سازی", value: "processing" },
          { label: "آماده ارسال", value: "ready" },
          { label: "ارسال‌شده", value: "sent" },
          { label: "تکمیل‌شده", value: "completed" },
          { label: "لغوشده", value: "canceled" }
        ]
      },
      { key: "paymentReceiptUrl", label: "فیش واریزی", type: "image", dir: "ltr", readonly: true },
      { key: "customerNote", label: "یادداشت مشتری", type: "textarea" },
      { key: "adminNote", label: "یادداشت مدیریت", type: "textarea" }
    ]
  },
  {
    key: "payment-methods",
    title: "روش‌های پرداخت",
    singular: "روش پرداخت",
    description: "فعال‌سازی کارت‌به‌کارت و درگاه پرداخت سایت",
    canCreate: false,
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      {
        key: "type",
        label: "نوع روش",
        type: "select",
        readonly: true,
        list: true,
        options: [
          { label: "کارت‌به‌کارت", value: "cardToCard" },
          { label: "درگاه بانکی", value: "bankGateway" },
          { label: "زرین‌پال", value: "zarinpal" }
        ]
      },
      { key: "merchantId", label: "شناسه پذیرنده / Merchant ID", type: "text", dir: "ltr" },
      { key: "isActive", label: "وضعیت", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "shipping-methods",
    title: "روش‌های ارسال",
    singular: "روش ارسال",
    description: "مدیریت پست، تیپاکس و مدل محاسبه هزینه ارسال",
    fields: [
      { key: "title", label: "عنوان روش ارسال", type: "text", required: true, list: true },
      {
        key: "code",
        label: "نوع ارسال",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "تیپاکس", value: "tipax" },
          { label: "پست", value: "post" }
        ]
      },
      { key: "description", label: "توضیح نمایش در سبد خرید", type: "textarea", list: true },
      {
        key: "pricingType",
        label: "مدل هزینه",
        type: "select",
        required: true,
        list: true,
        options: [
          { label: "پس‌کرایه", value: "collect" },
          { label: "بر اساس وزن و حجم", value: "weightVolume" },
          { label: "مبلغ ثابت", value: "fixed" }
        ]
      },
      { key: "basePrice", label: "هزینه پایه پست (تومان)", type: "number", min: 0, list: true },
      { key: "pricePerKg", label: "هزینه هر کیلوگرم (تومان)", type: "number", min: 0 },
      { key: "pricePerVolume", label: "هزینه حجم مرسوله (تومان)", type: "number", min: 0 },
      { key: "sortOrder", label: "ترتیب نمایش", type: "number", min: 1, list: true },
      { key: "isActive", label: "وضعیت", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "discount-codes",
    title: "کدهای تخفیف",
    singular: "کد تخفیف",
    description: "محدودیت، بازه اعتبار و میزان استفاده",
    fields: [
      { key: "code", label: "کد", type: "text", required: true, dir: "ltr", list: true },
      {
        key: "type",
        label: "نوع تخفیف",
        type: "select",
        required: true,
        options: [
          { label: "درصدی", value: "percent" },
          { label: "مبلغ ثابت", value: "fixed" }
        ],
        list: true
      },
      { key: "value", label: "مقدار", type: "number", required: true, min: 1, list: true },
      { key: "minOrderAmount", label: "حداقل سفارش", type: "number", min: 0 },
      { key: "maxUsageCount", label: "حداکثر استفاده", type: "number", min: 1 },
      { key: "usedCount", label: "تعداد استفاده", type: "number", min: 0 },
      { key: "startDate", label: "شروع اعتبار", type: "date", required: true },
      { key: "endDate", label: "پایان اعتبار", type: "date", required: true },
      { key: "isActive", label: "وضعیت", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "articles",
    title: "مقالات",
    singular: "مقاله",
    description: "محتوای آموزشی و ورودی ارگانیک گوگل",
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      { key: "slug", label: "نامک", type: "text", required: true, dir: "ltr", list: true },
      { key: "summary", label: "خلاصه", type: "textarea", required: true },
      { key: "content", label: "متن مقاله", type: "richtext", required: true },
      { key: "imageUrl", label: "تصویر شاخص", type: "image", dir: "ltr" },
      { key: "tags", label: "تگ‌ها (با ویرگول جدا شوند)", type: "text" },
      { key: "isPublished", label: "انتشار", type: "select", options: yesNo, list: true }
    ]
  },
  {
    key: "tags",
    title: "تگ‌ها",
    singular: "تگ",
    description: "برچسب‌های مشترک محتوای سایت",
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      { key: "slug", label: "نامک", type: "text", required: true, dir: "ltr", list: true },
      { key: "seoTitle", label: "عنوان سئو", type: "text", maxLength: 60 },
      { key: "seoDescription", label: "توضیحات متا", type: "textarea", maxLength: 150 },
      { key: "content", label: "محتوای تگ", type: "richtext" }
    ]
  }
];

export const getAdminResource = (key: string) => adminResources.find((resource) => resource.key === key);
