import { z } from "zod";
import { normalizePhone } from "../security.js";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).transform((value) => value || null);
const productImageUrl = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/v1\/product-images\/[0-9a-f-]+\.(?:jpg|png|webp)$/),
  z.literal(""),
  z.null()
]).transform((value) => value || null);
const money = z.number().int().min(0).max(10_000_000_000);
const slug = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const categorySchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug,
  description: z.string().trim().max(100_000).nullable().optional(),
  imageUrl: productImageUrl.optional(),
  seoTitle: z.string().trim().min(10).max(220),
  seoDescription: z.string().trim().min(30).max(500),
  isActive: z.boolean().default(true)
});

export const productSchema = z.object({
  titleFa: z.string().trim().min(2).max(220),
  titleEn: z.string().trim().min(2).max(220),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(10).max(5000),
  productContent: z.string().trim().max(100_000).nullable().optional(),
  roastType: z.enum(["light", "medium", "mediumDark", "dark"]),
  coffeeType: z.enum(["bean", "ground"]),
  grindType: z.enum(["espresso", "mokaPot", "frenchPress", "turkish", "filter", "none"]).default("none"),
  blendType: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(1).max(999).default(100),
  saleType: z.enum(["weighted", "packaged"]).default("weighted"),
  packageWeightGrams: z.union([z.literal(250), z.literal(500), z.literal(1000)]).default(250),
  stockStatus: z.enum(["inStock", "outOfStock"]).default("inStock"),
  purchasePricePerKg: money,
  salePricePerKg: money,
  showInBestSellers: z.boolean().default(false),
  showInDiscounts: z.boolean().default(false),
  isActive: z.boolean().default(true),
  imageUrl: productImageUrl.optional()
});

export const paymentMethodSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(["cardToCard", "bankGateway", "zarinpal"]),
  merchantId: z.string().trim().min(8).max(80).nullable().optional(),
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
  content: z.string().trim().min(50).max(100_000),
  imageUrl: optionalUrl.optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  isPublished: z.boolean().default(false)
});

export const tagSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug,
  content: z.string().trim().max(100_000).nullable().optional()
});

export const orderAdminSchema = z.object({
  paymentStatus: z.enum(["pending", "paid", "rejected"]),
  orderStatus: z.enum(["new", "processing", "ready", "sent", "completed", "canceled"]),
  paymentReceiptUrl: optionalUrl.optional(),
  adminNote: z.string().trim().max(3000).nullable().optional()
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
    "payment-methods", "discount-codes", "articles", "tags", "site-settings"
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
  websiteUrl: z.string().url().max(500),
  address: z.string().trim().max(1000).nullable().optional(),
  footerHeading: z.string().trim().min(10).max(300),
  footerDescription: z.string().trim().min(10).max(500),
  footerCopyright: z.string().trim().min(5).max(300),
  logoUrl: optionalUrl,
  faviconUrl: z.string().trim().min(1).max(500),
  homepageSeoTitle: z.string().trim().min(10).max(220),
  homepageSeoDescription: z.string().trim().min(30).max(500),
  homepageSeoKeywords: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
  homepageOgImageUrl: z.string().trim().min(1).max(500),
  homepageBannerDesktopUrl: z.string().trim().max(500).nullable().optional(),
  homepageBannerMobileUrl: z.string().trim().max(500).nullable().optional(),
  searchIndexingEnabled: z.boolean(),
  invoiceNationalId: z.string().trim().min(10).max(20)
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
  customerNote: z.string().trim().max(2000).nullable().optional(),
  items: z.array(orderItemInputSchema).min(1).max(30)
});
