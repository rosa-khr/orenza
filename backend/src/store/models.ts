export type RoastType = "light" | "medium" | "mediumDark" | "dark";
export type CoffeeType = "bean" | "ground";
export type GrindType = "espresso" | "mokaPot" | "frenchPress" | "turkish" | "filter" | "none";
export type SaleType = "weighted" | "packaged";
export type StockStatus = "inStock" | "outOfStock";
export type DiscountType = "percent" | "fixed";
export type PaymentStatus = "pending" | "paid" | "rejected";
export type OrderStatus = "new" | "processing" | "ready" | "sent" | "completed" | "canceled";

export interface Product {
  id: string;
  titleFa: string;
  titleEn: string;
  categoryId: string;
  description: string;
  productContent: string | null;
  tagIds: string[];
  relatedProductIds: string[];
  roastType: RoastType;
  coffeeType: CoffeeType;
  grindType: GrindType;
  blendType: string;
  sortOrder: number;
  saleType: SaleType;
  packageWeightGrams: 250 | 500 | 1000;
  stockStatus: StockStatus;
  purchasePricePerKg: number;
  salePricePerKg: number;
  profitPerKg: number;
  pricePer100g: number;
  pricePer250g: number;
  pricePer500g: number;
  pricePer1000g: number;
  isActive: boolean;
  showInBestSellers: boolean;
  showInDiscounts: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  title: string;
  slug: string;
  parentCategoryId: string | null;
  description: string | null;
  imageUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  showInPopularFooter: boolean;
  isActive: boolean;
}

export interface PaymentMethod {
  id: string;
  title: string;
  type: "cardToCard" | "bankGateway" | "zarinpal";
  merchantId: string | null;
  isActive: boolean;
}

export interface PaymentCard {
  id: string;
  paymentMethodId: string;
  cardNumber: string;
  shebaNumber: string;
  accountNumber: string;
  accountOwner: string;
  bankName: string;
  isActive: boolean;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrderAmount: number;
  maxUsageCount: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  imageUrl: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  title: string;
  slug: string;
  content: string | null;
}

export interface OrderItem {
  productId: string;
  productTitle: string;
  weight: 100 | 250 | 500 | 1000;
  quantity: number;
  grindType: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethodId: string;
  paymentCardId: string | null;
  paymentAuthority: string | null;
  paymentRefId: string | null;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentReceiptUrl: string | null;
  customerNote: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}
