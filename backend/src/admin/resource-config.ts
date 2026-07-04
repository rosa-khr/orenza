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
      roastType: "roast_type", coffeeType: "coffee_type", grindType: "grind_type", blendType: "blend_type",
      sortOrder: "sort_order",
      saleType: "sale_type", packageWeightGrams: "package_weight_grams",
      stockStatus: "stock_status",
      purchasePricePerKg: "purchase_price_per_kg", salePricePerKg: "sale_price_per_kg",
      isActive: "is_active", imageUrl: "image_url", ...audit
    },
    search: ["title_fa", "title_en", "blend_type"],
    schema: productSchema
  },
  categories: {
    table: "categories",
    columns: {
      title: "title", slug: "slug", description: "description", seoTitle: "seo_title",
      seoDescription: "seo_description", isActive: "is_active", ...audit
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
    columns: { title: "title", slug: "slug", ...audit },
    search: ["title", "slug"],
    schema: tagSchema
  },
  orders: {
    table: "orders",
    columns: {
      orderNumber: "order_number", customerName: "customer_name", customerPhone: "customer_phone",
      customerAddress: "customer_address", totalAmount: "total_amount", discountAmount: "discount_amount",
      finalAmount: "final_amount", paymentMethodId: "payment_method_id", paymentStatus: "payment_status",
      orderStatus: "order_status", paymentReceiptUrl: "payment_receipt_url", customerNote: "customer_note",
      adminNote: "admin_note", ...audit
    },
    search: ["order_number", "customer_name", "customer_phone"],
    schema: orderAdminSchema,
    adminReadonly: [
      "orderNumber", "customerName", "customerPhone", "customerAddress", "totalAmount",
      "discountAmount", "finalAmount", "paymentMethodId", "customerNote"
    ]
  }
};
