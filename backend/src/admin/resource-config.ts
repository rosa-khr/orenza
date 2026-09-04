import {
  articleSchema,
  adminUserSchema,
  adminRoleSchema,
  categorySchema,
  discountCodeSchema,
  orderAdminSchema,
  paymentCardSchema,
  paymentMethodSchema,
  productSchema,
  serviceScriptSchema,
  shippingMethodSchema,
  tagSchema
} from "../store/schemas.js";

export type ResourceConfig = {
  table: string;
  columns: Record<string, string>;
  search: string[];
  schema: { parse: (value: unknown) => Record<string, unknown> };
  adminReadonly?: string[];
};

const audit = { createdAt: "created_at", updatedAt: "updated_at" };

export const resourceConfigs: Record<string, ResourceConfig> = {
  roles: {
    table: "admin_roles",
    columns: {
      title: "title", slug: "slug", isSystem: "is_system", isActive: "is_active", ...audit
    },
    search: ["title", "slug"],
    schema: adminRoleSchema
  },
  users: {
    table: "users",
    columns: {
      firstName: "first_name", lastName: "last_name", displayName: "display_name",
      username: "username", phone: "phone", email: "email", role: "role",
      lastLoginAt: "last_login_at", ...audit
    },
    search: ["first_name", "last_name", "display_name", "phone", "email", "username"],
    schema: adminUserSchema,
    adminReadonly: ["username", "phone", "email", "lastLoginAt", "createdAt", "updatedAt"]
  },
  products: {
    table: "products",
    columns: {
      titleFa: "title_fa", titleEn: "title_en", categoryId: "category_id", description: "description",
      seoTitle: "seo_title", seoDescription: "seo_description",
      productContent: "product_content",
      roastType: "roast_type", coffeeType: "coffee_type", grindType: "grind_type", blendType: "blend_type",
      sortOrder: "sort_order",
      saleType: "sale_type", packageWeightGrams: "package_weight_grams",
      stockStatus: "stock_status",
      purchasePricePerKg: "purchase_price_per_kg", salePricePerKg: "sale_price_per_kg",
      showInBestSellers: "show_in_best_sellers", showInDiscounts: "show_in_discounts",
      isActive: "is_active", imageUrl: "image_url", ...audit
    },
    search: ["title_fa", "title_en", "blend_type"],
    schema: productSchema
  },
  categories: {
    table: "categories",
    columns: {
      title: "title", slug: "slug", description: "description", seoTitle: "seo_title",
      seoDescription: "seo_description", imageUrl: "image_url", isActive: "is_active", ...audit
    },
    search: ["title", "slug"],
    schema: categorySchema
  },
  "payment-methods": {
    table: "payment_methods",
    columns: {
      title: "title", type: "type", merchantId: "merchant_id", isActive: "is_active", ...audit
    },
    search: ["title", "account_owner", "bank_name"],
    schema: paymentMethodSchema
  },
  "payment-cards": {
    table: "payment_cards",
    columns: {
      paymentMethodId: "payment_method_id", cardNumber: "card_number", shebaNumber: "sheba_number",
      accountNumber: "account_number", accountOwner: "account_owner", bankName: "bank_name",
      isActive: "is_active", ...audit
    },
    search: ["card_number", "sheba_number", "account_number", "account_owner"],
    schema: paymentCardSchema
  },
  "shipping-methods": {
    table: "shipping_methods",
    columns: {
      title: "title", code: "code", description: "description", pricingType: "pricing_type",
      basePrice: "base_price", pricePerKg: "price_per_kg", pricePerVolume: "price_per_volume",
      sortOrder: "sort_order", isActive: "is_active", ...audit
    },
    search: ["title", "code", "description"],
    schema: shippingMethodSchema
  },
  "discount-codes": {
    table: "discount_codes",
    columns: {
      code: "code", type: "type", value: "value", minOrderAmount: "min_order_amount",
      maxUsageCount: "max_usage_count", usedCount: "used_count", startDate: "start_date",
      endDate: "end_date", isActive: "is_active", ...audit
    },
    search: ["code"],
    schema: discountCodeSchema
  },
  articles: {
    table: "articles",
    columns: {
      title: "title", slug: "slug", summary: "summary", content: "content", imageUrl: "image_url",
      tags: "tags", isPublished: "is_published", ...audit
    },
    search: ["title", "slug", "summary"],
    schema: articleSchema
  },
  tags: {
    table: "tags",
    columns: { title: "title", slug: "slug", seoTitle: "seo_title", seoDescription: "seo_description", content: "content", ...audit },
    search: ["title", "slug"],
    schema: tagSchema
  },
  "service-scripts": {
    table: "service_scripts",
    columns: {
      title: "title", provider: "provider", serviceKey: "service_key",
      placement: "placement", isActive: "is_active", ...audit
    },
    search: ["title", "provider", "service_key"],
    schema: serviceScriptSchema
  },
  orders: {
    table: "orders",
    columns: {
      orderNumber: "order_number", customerName: "customer_name", customerPhone: "customer_phone",
      customerAddress: "customer_address", totalAmount: "total_amount", discountAmount: "discount_amount",
      taxAmount: "tax_amount", finalAmount: "final_amount", paymentMethodId: "payment_method_id",
      paymentCardId: "payment_card_id", paymentAuthority: "payment_authority", paymentRefId: "payment_ref_id",
      paymentStatus: "payment_status", orderStatus: "order_status", paymentReceiptUrl: "payment_receipt_url", customerNote: "customer_note",
      adminNote: "admin_note", ...audit
    },
    search: ["order_number", "customer_name", "customer_phone"],
    schema: orderAdminSchema,
    adminReadonly: [
      "orderNumber", "customerName", "customerPhone", "customerAddress", "totalAmount",
      "discountAmount", "taxAmount", "finalAmount", "paymentMethodId", "paymentCardId",
      "paymentAuthority", "paymentRefId", "customerNote"
    ]
  }
};
