import { z } from "zod";
import { normalizePhone } from "../security.js";
import { sanitizeRichText } from "../rich-text.js";
import { normalizeSlug, productSlug } from "../seo.js";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).transform((value) => value || null);
const canonicalUrl = z.union([
  z.string().trim().url(),
  z.string().trim().regex(/^\/[^#]*$/),
  z.literal(""),
  z.null()
]).transform((value) => {
  if (!value) return null;
  if (String(value).includes("#")) throw new Error("Canonical URL نباید شامل fragment باشد.");
  return value;
});
const seoFields = {
  canonicalUrl: canonicalUrl.optional(),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true)
};
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/);
const productImageUrl = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/v1\/product-images\/[0-9a-f-]+\.(?:jpg|png|webp)$/),
  z.string().regex(/^\/images\/[a-zA-Z0-9/_-]+\.(?:jpg|jpeg|png|webp|svg)$/),
  z.literal(""),
  z.null()
]).transform((value) => value || null);
const productImageGallery = z.union([
  z.array(productImageUrl).max(12),
  z.string().transform((value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }).pipe(z.array(productImageUrl).max(12))
]).transform((value) => value.filter(Boolean) as string[]);
const money = z.number().int().min(0).max(10_000_000_000);
const productMoney = (label: string) => z.number()
  .int({ message: `${label} باید عدد صحیح باشد.` })
  .min(0, { message: `${label} نمی‌تواند منفی باشد.` })
  .max(10_000_000_000, { message: `${label} بیش از حد مجاز است.` });
const normalizedSlug = z.string().transform(normalizeSlug);
const slug = normalizedSlug.pipe(z.string()
  .min(2, { message: "نامک باید حداقل ۲ کاراکتر باشد." })
  .max(180, { message: "نامک نمی‌تواند بیشتر از ۱۸۰ کاراکتر باشد." })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد؛ مثل coffee-blends."
  }));
const optionalRichText = z.union([z.string().max(100_000), z.literal(""), z.null()])
  .transform((value) => sanitizeRichText(value));
const homepageBannerRowSchema = z.object({
  id: z.enum(["aboveDiscount", "aboveBest"]),
  title: z.string().trim().min(2).max(80),
  columns: z.number().int().min(1).max(4),
  isActive: z.boolean().default(false),
  items: z.array(z.object({
    id: z.string().trim().min(6).max(80),
    imageUrl: z.string().trim().min(1).max(500),
    alt: z.string().trim().max(160).default(""),
    href: z.union([z.string().url(), z.string().regex(/^\/[^\s]*$/), z.literal("")]).default(""),
    seoTitle: z.string().trim().max(60).default(""),
    seoDescription: z.string().trim().max(150).default(""),
    geoSummary: z.string().trim().max(500).default(""),
    ieoIntent: z.string().trim().max(160).default(""),
    isActive: z.boolean().default(true)
  })).max(12).default([])
}).superRefine((data, context) => {
  if (data.items.length > data.columns) {
    context.addIssue({
      code: "custom",
      message: "تعداد بنرهای هر ردیف نمی‌تواند بیشتر از تعداد ستون انتخابی باشد.",
      path: ["items"]
    });
  }
});

const homepageHeroBenefitItemSchema = z.object({
  text: z.string().trim().min(2).max(120),
  icon: z.enum(["send", "cart", "coffee", "grind", "bean", "store", "home", "grid", "bell", "user", "search", "phone"])
});

export const categorySchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug,
  sortOrder: z.number()
    .int({ message: "ترتیب نمایش باید عدد صحیح باشد." })
    .min(1, { message: "ترتیب نمایش باید حداقل ۱ باشد." })
    .max(32767)
    .default(100),
  parentCategoryId: z.string().uuid().nullable().optional(),
  description: optionalRichText.optional(),
  imageUrl: productImageUrl.optional(),
  seoTitle: z.string().trim().max(60).nullable().optional(),
  seoDescription: z.string().trim().max(150).nullable().optional(),
  ...seoFields,
  showInPopularFooter: z.boolean().default(false),
  showInPopularSearches: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export const productSchema = z.object({
  titleFa: z.string()
    .trim()
    .min(2, { message: "عنوان فارسی باید حداقل ۲ کاراکتر باشد." })
    .max(220, { message: "عنوان فارسی نمی‌تواند بیشتر از ۲۲۰ کاراکتر باشد." }),
  titleEn: z.string()
    .trim()
    .min(2, { message: "عنوان انگلیسی باید حداقل ۲ کاراکتر باشد." })
    .max(220, { message: "عنوان انگلیسی نمی‌تواند بیشتر از ۲۲۰ کاراکتر باشد." }),
  slug: z.preprocess((value) => value === "" || value === null ? undefined : value,
    normalizedSlug.pipe(z.string().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).optional()),
  categoryId: z.string().uuid({ message: "یک دسته‌بندی معتبر انتخاب کنید." }),
  description: z.string()
    .trim()
    .min(10, { message: "توضیحات محصول باید حداقل ۱۰ کاراکتر باشد." })
    .max(5000, { message: "توضیحات محصول نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد." }),
  seoTitle: z.string()
    .trim()
    .max(60, { message: "عنوان سئو نمی‌تواند بیشتر از ۶۰ کاراکتر باشد." })
    .nullable()
    .optional(),
  seoDescription: z.string()
    .trim()
    .max(150, { message: "توضیحات متا نمی‌تواند بیشتر از ۱۵۰ کاراکتر باشد." })
    .nullable()
    .optional(),
  ...seoFields,
  productContent: optionalRichText.optional(),
  tagIds: z.array(z.string().uuid({ message: "تگ انتخاب‌شده معتبر نیست." }))
    .max(30, { message: "حداکثر ۳۰ تگ برای هر محصول قابل انتخاب است." })
    .default([]),
  relatedProductIds: z.array(z.string().uuid({ message: "محصول مرتبط انتخاب‌شده معتبر نیست." }))
    .max(20, { message: "حداکثر ۲۰ محصول مرتبط قابل انتخاب است." })
    .default([]),
  roastType: z.enum(["light", "medium", "mediumDark", "dark"]),
  coffeeType: z.enum(["bean", "ground"]),
  grindType: z.enum(["espresso", "mokaPot", "frenchPress", "turkish", "filter", "none"]).default("none"),
  blendType: z.string()
    .trim()
    .min(2, { message: "ترکیب دانه باید حداقل ۲ کاراکتر باشد." })
    .max(120, { message: "ترکیب دانه نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد." }),
  sortOrder: z.number()
    .int({ message: "ترتیب نمایش باید عدد صحیح باشد." })
    .min(1, { message: "ترتیب نمایش باید حداقل ۱ باشد." })
    .max(999, { message: "ترتیب نمایش نمی‌تواند بیشتر از ۹۹۹ باشد." })
    .default(100),
  saleType: z.enum(["weighted", "packaged"]).default("weighted"),
  packageWeightGrams: z.union([z.literal(250), z.literal(500), z.literal(1000)]).default(250),
  stockStatus: z.enum(["inStock", "outOfStock"]).default("inStock"),
  purchasePricePerKg: productMoney("قیمت خرید واحد"),
  salePricePerKg: productMoney("قیمت فروش واحد"),
  discountPercent: z.number()
    .int({ message: "درصد تخفیف باید عدد صحیح باشد." })
    .min(0, { message: "درصد تخفیف نمی‌تواند منفی باشد." })
    .max(100, { message: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد." })
    .nullable()
    .optional(),
  discountSalePricePerKg: z.union([productMoney("قیمت بعد از تخفیف"), z.null()]).optional(),
  showInBestSellers: z.boolean().default(false),
  showInDiscounts: z.boolean().default(false),
  showInPopularFooter: z.boolean().default(false),
  showInPopularSearches: z.boolean().default(false),
  isActive: z.boolean().default(true),
  imageUrl: productImageUrl.optional(),
  productImageUrls: productImageGallery.default([])
}).transform((product) => ({
  ...product,
  slug: product.slug || productSlug(product.titleEn),
  imageUrl: product.productImageUrls[0] || product.imageUrl || null
}));

export const paymentMethodSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(["cardToCard", "bankGateway", "zarinpal"]),
  merchantId: z.string().trim().min(8).max(80).nullable().optional(),
  taxPercent: z.coerce.number().min(0).max(100).default(10),
  isActive: z.boolean().default(true)
}).superRefine((data, context) => {
  if ((data.type === "zarinpal" || data.type === "bankGateway") && !data.merchantId) {
    context.addIssue({ code: "custom", message: "شناسه پذیرنده درگاه الزامی است.", path: ["merchantId"] });
  }
});

export const paymentCardSchema = z.object({
  paymentMethodId: z.string().uuid(),
  cardNumber: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{16}$/)),
  shebaNumber: z.string()
    .transform((value) => normalizePhone(value.replace(/^IR/i, "")))
    .pipe(z.string().regex(/^\d{24}$/)),
  accountNumber: z.string().transform(normalizePhone).pipe(z.string().min(5).max(40)),
  accountOwner: z.string().trim().min(3).max(160),
  bankName: z.string().trim().min(2).max(100),
  isActive: z.boolean().default(true)
});

export const shippingMethodSchema = z.object({
  title: z.string().trim().min(2).max(120),
  code: z.enum(["tipax", "post"]),
  description: z.string().trim().max(300).default(""),
  pricingType: z.enum(["collect", "weightVolume", "fixed"]).default("fixed"),
  basePrice: z.coerce.number().int().min(0).max(100_000_000).default(0),
  pricePerKg: z.coerce.number().int().min(0).max(100_000_000).default(0),
  pricePerVolume: z.coerce.number().int().min(0).max(100_000_000).default(0),
  sortOrder: z.coerce.number().int().min(1).max(999).default(1),
  isActive: z.boolean().default(true)
}).superRefine((data, context) => {
  if (data.code === "tipax" && data.pricingType !== "collect") {
    context.addIssue({ code: "custom", path: ["pricingType"], message: "برای تیپاکس فعلاً حالت پس‌کرایه انتخاب شود." });
  }
  if (data.code === "post" && data.pricingType === "collect") {
    context.addIssue({ code: "custom", path: ["pricingType"], message: "برای پست، مدل هزینه بر اساس وزن/حجم یا ثابت تنظیم شود." });
  }
});

export const discountCodeSchema = z.object({
  code: z.string().trim().min(3).max(60).transform((value) => value.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().positive(),
  minOrderAmount: money.default(0),
  maxUsageCount: z.number().int().positive().nullable().optional(),
  usedCount: z.number().int().min(0).default(0),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true)
}).refine((data) => data.endDate > data.startDate, {
  message: "تاریخ پایان باید بعد از تاریخ شروع باشد.",
  path: ["endDate"]
}).refine((data) => data.type !== "percent" || data.value <= 100, {
  message: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.",
  path: ["value"]
});

export const articleSchema = z.object({
  title: z.string().trim().min(3).max(240),
  slug,
  summary: z.string().trim().min(20).max(1000),
  content: z.string().trim().min(50).max(100_000).transform((value) => sanitizeRichText(value) || ""),
  imageUrl: productImageUrl.optional(),
  seoTitle: z.string().trim().max(60).nullable().optional(),
  seoDescription: z.string().trim().max(150).nullable().optional(),
  ...seoFields,
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  showInLatest: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  publishedAt: z.coerce.date().nullable().optional()
});

export const tagSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug,
  imageUrl: productImageUrl.optional(),
  seoTitle: z.string().trim().max(60).nullable().optional(),
  seoDescription: z.string().trim().max(150).nullable().optional(),
  ...seoFields,
  content: optionalRichText.optional(),
  showInPopularSearches: z.boolean().default(false)
});

export const orderAdminSchema = z.object({
  paymentStatus: z.enum(["pending", "paid", "rejected"]),
  orderStatus: z.enum(["new", "processing", "ready", "sent", "completed", "canceled"]),
  paymentReceiptUrl: optionalUrl.optional(),
  adminNote: z.string().trim().max(3000).nullable().optional()
});

export const redirectSchema = z.object({
  sourcePath: z.string().trim().min(1).max(500),
  destination: z.string().trim().min(1).max(500),
  statusCode: z.coerce.number().int().refine((value) => value === 301 || value === 302, {
    message: "نوع ریدایرکت باید 301 یا 302 باشد."
  }).default(301),
  entityType: z.string().trim().max(80).nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true)
});

export const adminUserSchema = z.object({
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100)
});

export const adminRoleSchema = z.object({
  title: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  permissions: z.array(z.enum([
    "dashboard", "users", "roles", "products", "categories", "orders",
    "payment-methods", "shipping-methods", "discount-codes", "articles", "tags", "redirects", "site-settings", "logs", "content-generator", "accounting", "price-imports"
  ])).min(1),
  isActive: z.boolean().default(true)
});

export const siteSettingsSchema = z.object({
  brandName: z.string().trim().min(2).max(120),
  brandNameEn: z.string().trim().min(2).max(120),
  brandTagline: z.string().trim().min(3).max(240),
  supportPhone: z.string().trim().min(7).max(30),
  supportEmail: z.string().trim().email().max(254),
  whatsappUrl: z.string().url().max(500),
  baleUrl: z.string().url().max(500),
  instagramUrl: z.string().url().max(500),
  telegramUrl: z.string().url().max(500),
  websiteUrl: z.string().url().max(500),
  address: z.string().trim().max(1000).nullable().optional(),
  footerHeading: z.string().trim().min(10).max(300),
  footerDescription: z.string().trim().min(10).max(500),
  footerCopyright: z.string().trim().min(5).max(300),
  footerCopyrightEn: z.string().trim().min(5).max(300),
  termsContent: z.string().trim().min(50).max(20000),
  logoUrl: optionalUrl,
  faviconUrl: z.string().trim().min(1).max(500),
  homepageSeoTitle: z.string().trim().min(10).max(60),
  homepageSeoDescription: z.string().trim().min(30).max(150),
  homepageSeoKeywords: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
  homepageOgImageUrl: z.string().trim().min(1).max(500),
  homepageHeroEyebrow: z.string().trim().min(2).max(180),
  homepageHeroTitle: z.string().trim().min(2).max(180),
  homepageHeroTitleAccent: z.string().trim().min(2).max(180),
  homepageHeroDescription: z.string().trim().min(10).max(500),
  homepageHeroPrimaryLabel: z.string().trim().min(2).max(120),
  homepageHeroPrimaryHref: z.string().trim().min(1).max(500),
  homepageHeroSecondaryLabel: z.string().trim().min(2).max(120),
  homepageHeroSecondaryHref: z.string().trim().min(1).max(500),
  homepageHeroBenefits: z.array(z.string().trim().min(2).max(120)).min(1).max(5),
  homepageHeroBenefitItems: z.array(homepageHeroBenefitItemSchema).min(1).max(5),
  homepageBannerDesktopUrl: z.string().trim().max(500).nullable().optional(),
  homepageBannerMobileUrl: z.string().trim().max(500).nullable().optional(),
  homepageBannerRows: z.array(homepageBannerRowSchema).length(2),
  homepageBestSellersEnabled: z.boolean().default(true),
  homepageDiscountsEnabled: z.boolean().default(true),
  homepageBestSellersTitle: z.string().trim().min(2).max(120),
  homepageBestSellersColor: hexColor,
  homepageBestSellersTextColor: hexColor.default("#ffffff"),
  homepageBestSellersBadgeLabel: z.string().trim().min(1).max(40).default("پرفروش"),
  homepageBestSellersBadgeColor: hexColor.default("#293b32"),
  homepageBestSellersIconColor: hexColor.default("#293b32"),
  homepageDiscountsTitle: z.string().trim().min(2).max(120),
  homepageDiscountsColor: hexColor,
  homepageDiscountsCountdownEnabled: z.boolean().default(false),
  homepageDiscountsExpiresAt: z.string().trim().datetime().nullable().optional(),
  homepageDiscountsTextColor: hexColor.default("#ffffff"),
  homepageDiscountsBadgeLabel: z.string().trim().min(1).max(40).default("پیشنهاد ویژه"),
  homepageDiscountsBadgeColor: hexColor.default("#b72d3a"),
  homepageDiscountsIconColor: hexColor.default("#b72d3a"),
  themeSurfaceColor: hexColor.default("#faf9f6"),
  themeFooterColor: hexColor.default("#211d19"),
  themeSupportColor: hexColor.default("#173f33"),
  themeHeaderIconColor: hexColor.default("#2d5644"),
  searchIndexingEnabled: z.boolean(),
  robotsRules: z.string().trim().min(10).max(6000),
  sitemapEnabled: z.boolean().default(true),
  sitemapHomepageEnabled: z.boolean().default(true),
  sitemapTermsEnabled: z.boolean().default(true),
  sitemapStaticEnabled: z.boolean().default(true),
  sitemapProductsEnabled: z.boolean().default(true),
  sitemapCategoriesEnabled: z.boolean().default(true),
  sitemapTagsEnabled: z.boolean().default(true),
  sitemapArticlesEnabled: z.boolean().default(true),
  sitemapHomepageChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapTermsChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapStaticChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapProductsChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapCategoriesChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapTagsChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapArticlesChangefreq: z.enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]).default("monthly"),
  sitemapHomepagePriority: z.coerce.number().min(0).max(1).default(0.9),
  sitemapTermsPriority: z.coerce.number().min(0).max(1).default(0.9),
  sitemapStaticPriority: z.coerce.number().min(0).max(1).default(0.8),
  sitemapProductsPriority: z.coerce.number().min(0).max(1).default(0.9),
  sitemapCategoriesPriority: z.coerce.number().min(0).max(1).default(0.8),
  sitemapTagsPriority: z.coerce.number().min(0).max(1).default(0.7),
  sitemapArticlesPriority: z.coerce.number().min(0).max(1).default(0.7),
  invoiceNationalId: z.string().trim().min(10).max(20),
  contentAiApiKey: z.string().trim().max(500).optional(),
  contentAiModel: z.string().trim().min(2).max(100).optional()
  ,contentAiInstructions: z.string().trim().min(20).max(3000).optional(),
  contentAiDefaultAudience: z.string().trim().min(2).max(200).optional(),
  contentAiDefaultTone: z.string().trim().min(2).max(100).optional(),
  contentAiDefaultLength: z.enum(["short", "medium", "long"]).optional(),
  contentAiDefaultLanguage: z.enum(["fa", "en"]).optional()
});

export const serviceScriptSchema = z.object({
  title: z.string().trim().min(2).max(120),
  provider: z.enum(["gtm", "ga4", "searchConsole"]),
  serviceKey: z.string().trim().min(4).max(220),
  placement: z.enum(["head", "body"]).default("head"),
  isActive: z.boolean().default(true)
}).superRefine((data, context) => {
  const patterns = {
    gtm: /^GTM-[A-Z0-9]+$/,
    ga4: /^G-[A-Z0-9]+$/,
    searchConsole: /^[A-Za-z0-9_-]+$/
  };
  if (!patterns[data.provider].test(data.serviceKey)) {
    context.addIssue({
      code: "custom",
      message: "شناسه واردشده با سرویس انتخابی سازگار نیست.",
      path: ["serviceKey"]
    });
  }
});

export const orderItemInputSchema = z.object({
  productId: z.string().uuid(),
  weight: z.union([z.literal(100), z.literal(250), z.literal(500), z.literal(1000)]),
  quantity: z.number().int().min(1).max(50),
  grindType: z.string().trim().min(2).max(80),
  roastType: z.string().trim().min(2).max(80),
  blendType: z.string().trim().min(2).max(120),
  brewMethod: z.string().trim().max(100).nullable().optional()
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(3).max(160),
  customerPhone: z.string().transform(normalizePhone).pipe(z.string().regex(/^09\d{9}$/)),
  customerAddress: z.string().trim().min(10).max(1000),
  customerProvince: z.string().trim().min(2).max(80),
  customerCity: z.string().trim().min(2).max(80),
  customerPostalCode: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{10}$/)),
  shippingMethod: z.enum(["tipax", "post"]),
  paymentMethodId: z.string().uuid(),
  paymentCardId: z.string().uuid().nullable().optional(),
  paymentRefId: z.string().trim().min(4).max(80).regex(/^[0-9]+$/, "کد پیگیری باید فقط شامل ارقام ۰ تا ۹ باشد.").optional(),
  paymentReceiptUrl: z.string().trim().max(500).optional(),
  discountCode: z.string().trim().max(60).optional(),
  termsAccepted: z.literal(true, { error: "پذیرش قوانین سایت برای ثبت سفارش الزامی است." }),
  customerNote: z.string().trim().max(2000).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1).max(30)
});
