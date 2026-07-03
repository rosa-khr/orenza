export type AdminFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "image";

export type AdminField = {
  key: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  min?: number;
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
};

const yesNo = [
  { label: "فعال", value: "true" },
  { label: "غیرفعال", value: "false" }
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
      { key: "salePricePerKg", label: "قیمت فروش واحد (تومان)", type: "number", required: true, min: 0, list: true },
      { key: "profitPerKg", label: "سود واحد (تومان)", type: "number", list: true, readonly: true },
      { key: "imageUrl", label: "تصویر محصول", type: "image", dir: "ltr" },
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
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "seoTitle", label: "عنوان سئو", type: "text", required: true },
      { key: "seoDescription", label: "توضیحات متا", type: "textarea", required: true },
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
      { key: "finalAmount", label: "مبلغ نهایی", type: "number", list: true },
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
          { label: "ارسال‌شده", value: "sent" },
          { label: "تکمیل‌شده", value: "completed" },
          { label: "لغوشده", value: "canceled" }
        ]
      },
      { key: "paymentReceiptUrl", label: "فیش واریزی", type: "image", dir: "ltr" },
      { key: "customerNote", label: "یادداشت مشتری", type: "textarea" },
      { key: "adminNote", label: "یادداشت مدیریت", type: "textarea" }
    ]
  },
  {
    key: "payment-methods",
    title: "روش‌های پرداخت",
    singular: "روش پرداخت",
    description: "اطلاعات کارت‌به‌کارت قابل نمایش در سفارش",
    fields: [
      { key: "title", label: "عنوان", type: "text", required: true, list: true },
      { key: "merchantId", label: "شناسه پذیرنده / Merchant ID", type: "text", dir: "ltr" },
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
      { key: "content", label: "متن مقاله", type: "textarea", required: true },
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
      { key: "slug", label: "نامک", type: "text", required: true, dir: "ltr", list: true }
    ]
  }
];

export const getAdminResource = (key: string) => adminResources.find((resource) => resource.key === key);
