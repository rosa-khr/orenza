import type { Pool, PoolClient } from "pg";
import { createOrderSchema } from "./schemas.js";
import { toPublicRecord, withTransaction } from "../admin/repository.js";

type ProductPriceRow = {
  id: string;
  title_fa: string;
  is_active: boolean;
  sale_price_per_kg: string;
  sale_type: "weighted" | "packaged";
  package_weight_grams: number;
  stock_status: "inStock" | "outOfStock";
};

const nextOrderNumber = () => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `OR-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
};

const resolveDiscount = async (client: PoolClient, code: string | undefined, total: number) => {
  if (!code) return { id: null, amount: 0 };
  const result = await client.query<{
    id: string;
    type: "percent" | "fixed";
    value: string;
    min_order_amount: string;
  }>(`SELECT id, type, value, min_order_amount
      FROM discount_codes
      WHERE upper(code) = upper($1)
        AND is_active = true
        AND start_date <= now()
        AND end_date >= now()
        AND (max_usage_count IS NULL OR used_count < max_usage_count)
      FOR UPDATE`, [code]);
  const discount = result.rows[0];
  if (!discount) throw Object.assign(new Error("کد تخفیف معتبر نیست یا زمان استفاده از آن گذشته است."), { statusCode: 422 });
  if (total < Number(discount.min_order_amount)) {
    throw Object.assign(new Error("مبلغ سفارش به حداقل لازم برای این کد تخفیف نمی‌رسد."), { statusCode: 422 });
  }
  const raw = discount.type === "percent"
    ? Math.floor(total * Number(discount.value) / 100)
    : Number(discount.value);
  return { id: discount.id, amount: Math.min(total, raw) };
};

export class OrderService {
  constructor(private readonly pool: Pool) {}

  async create(input: unknown, userId: string | null) {
    const data = createOrderSchema.parse(input);
    return withTransaction(this.pool, async (client) => {
      const productIds = [...new Set(data.items.map((item) => item.productId))];
      const products = await client.query<ProductPriceRow>(
        `SELECT id, title_fa, is_active, sale_price_per_kg, sale_type, package_weight_grams, stock_status
         FROM products WHERE id = ANY($1::uuid[]) FOR SHARE`,
        [productIds]
      );
      const productMap = new Map(products.rows.map((product) => [product.id, product]));
      const items = data.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product?.is_active) {
          throw Object.assign(new Error("یکی از قهوه‌های انتخابی در حال حاضر قابل سفارش نیست."), { statusCode: 422 });
        }
        if (product.stock_status !== "inStock") {
          throw Object.assign(new Error(`${product.title_fa} در حال حاضر ناموجود است.`), { statusCode: 422 });
        }
        if (product.sale_type === "packaged" && item.weight !== product.package_weight_grams) {
          throw Object.assign(new Error("وزن بسته این محصول تغییر کرده است؛ لطفاً دوباره آن را انتخاب کنید."), { statusCode: 422 });
        }
        const unitPrice = product.sale_type === "packaged"
          ? Number(product.sale_price_per_kg)
          : Math.round(Number(product.sale_price_per_kg) * item.weight / 1000);
        return {
          ...item,
          productTitle: product.title_fa,
          unitPrice,
          totalPrice: unitPrice * item.quantity
        };
      });
      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const discount = await resolveDiscount(client, data.discountCode, totalAmount);
      const taxableAmount = Math.max(0, totalAmount - discount.amount);
      const taxAmount = Math.round(taxableAmount * 0.10);
      const finalAmount = taxableAmount + taxAmount;
      const payment = await client.query<{ id: string; type: "cardToCard" | "bankGateway" | "zarinpal" }>(
        "SELECT id,type FROM payment_methods WHERE id = $1 AND is_active = true FOR SHARE",
        [data.paymentMethodId]
      );
      const paymentMethod = payment.rows[0];
      if (!paymentMethod) {
        throw Object.assign(new Error("روش پرداخت انتخابی در حال حاضر فعال نیست."), { statusCode: 422 });
      }
      if (paymentMethod.type === "cardToCard") {
        if (!data.paymentCardId) {
          throw Object.assign(new Error("برای کارت‌به‌کارت، انتخاب کارت الزامی است."), { statusCode: 422 });
        }
        const paymentCard = await client.query<{ id: string }>(
          `SELECT id FROM payment_cards
           WHERE id = $1 AND payment_method_id = $2 AND is_active = true FOR SHARE`,
          [data.paymentCardId, data.paymentMethodId]
        );
        if (!paymentCard.rows[0]) {
          throw Object.assign(new Error("کارت انتخابی در حال حاضر فعال نیست."), { statusCode: 422 });
        }
        if (!data.paymentRefId || !data.paymentReceiptUrl) {
          throw Object.assign(new Error("برای کارت‌به‌کارت، کد پیگیری و تصویر فیش الزامی است."), { statusCode: 422 });
        }
      }
      const order = await client.query<Record<string, unknown>>(
        `INSERT INTO orders
          (order_number,user_id,customer_name,customer_phone,customer_address,customer_province,
           customer_city,customer_postal_code,shipping_method,total_amount,discount_amount,tax_amount,final_amount,
           discount_code_id,payment_method_id,payment_card_id,payment_ref_id,payment_receipt_url,
           payment_status,order_status,customer_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending','new',$19)
         RETURNING *`,
        [
          nextOrderNumber(), userId, data.customerName, data.customerPhone, data.customerAddress,
          data.customerProvince, data.customerCity, data.customerPostalCode, data.shippingMethod,
          totalAmount, discount.amount, taxAmount, finalAmount, discount.id, data.paymentMethodId,
          data.paymentCardId ?? null, data.paymentRefId ?? null, data.paymentReceiptUrl ?? null,
          data.customerNote ?? null
        ]
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items
            (order_id,product_id,product_title,weight,quantity,grind_type,roast_type,blend_type,brew_method,unit_price,total_price)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            order.rows[0]!.id, item.productId, item.productTitle, item.weight,
            item.quantity, item.grindType, item.roastType, item.blendType, item.brewMethod ?? null,
            item.unitPrice, item.totalPrice
          ]
        );
      }
      if (discount.id) await client.query("UPDATE discount_codes SET used_count = used_count + 1 WHERE id = $1", [discount.id]);
      return { ...toPublicRecord(order.rows[0]!), items };
    });
  }

  async validateDiscount(code: string, totalAmount: number) {
    return withTransaction(this.pool, async (client) => {
      const discount = await resolveDiscount(client, code, totalAmount);
      const taxableAmount = Math.max(0, totalAmount - discount.amount);
      const taxAmount = Math.round(taxableAmount * 0.10);
      return { code: code.toUpperCase(), discountAmount: discount.amount, taxAmount, finalAmount: taxableAmount + taxAmount };
    });
  }

  async markPaymentStarted(orderId: string, authority: string) {
    await this.pool.query(
      `UPDATE orders SET payment_authority = $2, payment_status = 'pending', updated_at = now()
       WHERE id = $1 AND payment_status = 'pending'`,
      [orderId, authority]
    );
  }

  async markPaymentVerified(orderId: string, authority: string, refId: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE orders
          SET payment_authority = $2, payment_ref_id = $3, payment_status = 'paid', order_status = 'processing', updated_at = now()
        WHERE id = $1 AND payment_status = 'pending'
        RETURNING *`,
      [orderId, authority, refId]
    );
    return result.rows[0] ? toPublicRecord(result.rows[0]) : null;
  }

  async markPaymentRejected(orderId: string, authority: string | null) {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE orders
          SET payment_authority = COALESCE($2, payment_authority), payment_status = 'rejected', updated_at = now()
        WHERE id = $1 AND payment_status = 'pending'
        RETURNING *`,
      [orderId, authority]
    );
    return result.rows[0] ? toPublicRecord(result.rows[0]) : null;
  }
}
