import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { toPublicRecord } from "../admin/repository.js";
import { getPublicSiteSettings, getSiteSettings } from "../site-settings.js";
import { OrderService } from "./order-service.js";
import { removePaymentReceipt, savePaymentReceipt } from "../payment-receipts.js";
import { openProductImage } from "../product-images.js";

type SessionUser = { id: string } | null;

type PaymentMethodRow = {
  id: string;
  title: string;
  type: "cardToCard" | "bankGateway" | "zarinpal";
  merchant_id: string | null;
};

type PaymentOrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  final_amount: number | string;
  payment_status: string;
  payment_method_id: string;
  payment_authority: string | null;
  payment_type: "cardToCard" | "bankGateway" | "zarinpal";
  merchant_id: string | null;
};

const getConfiguredPublicOrigin = () => {
  const configured = process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL;
  if (configured) return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  return null;
};

const getPublicOrigin = (request: FastifyRequest) => {
  const configured = getConfiguredPublicOrigin();
  if (configured) return configured;
  const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost:8080";
  const proto = request.headers["x-forwarded-proto"] || "http";
  return `${Array.isArray(proto) ? proto[0] : proto}://${Array.isArray(host) ? host[0] : host}`;
};

const isLocalOrigin = (origin: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(origin);

const zarinpalErrorMessage = (payload: { data?: { message?: string }; errors?: unknown }) => {
  const errors = payload.errors as { message?: string; code?: number } | undefined;
  if (errors?.code === -14) {
    return "دامنه بازگشت پرداخت با دامنه ثبت‌شده در زرین‌پال یکی نیست. PUBLIC_SITE_URL را برابر دامنه تأییدشده زرین‌پال تنظیم کنید.";
  }
  if (errors?.message) return `خطای زرین‌پال: ${errors.message}`;
  return payload.data?.message || "اتصال به زرین‌پال ناموفق بود.";
};

const zarinpalAmount = (amountInToman: number) => {
  const multiplier = Number(process.env.ZARINPAL_AMOUNT_MULTIPLIER || 10);
  return Math.max(1, Math.round(amountInToman * multiplier));
};

const zarinpalStartUrl = (authority: string) => `https://www.zarinpal.com/pg/StartPay/${authority}`;

export const registerStoreRoutes = (
  app: FastifyInstance,
  pool: Pool,
  getCurrentUser: (request: FastifyRequest) => Promise<SessionUser>
) => {
  const orderService = new OrderService(pool);

  app.get("/api/v1/site-settings", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { item: await getPublicSiteSettings(pool) };
  });

  app.get("/api/v1/indexing-policy", async (_request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.header("Cache-Control", "no-store");
    if (!settings.searchIndexingEnabled) {
      reply.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    return reply.code(204).send();
  });

  app.get("/api/v1/site-settings/robots.txt", async (_request, reply) => {
    const settings = await getSiteSettings(pool);
    reply.type("text/plain; charset=utf-8").header("Cache-Control", "no-store");
    return settings.searchIndexingEnabled
      ? "User-agent: *\nAllow: /\n\nSitemap: https://orenza.ir/sitemap-index.xml\n"
      : "User-agent: *\nDisallow: /\n";
  });

  app.get("/api/v1/products", async (request) => {
    const { category } = z.object({ category: z.string().trim().max(180).optional() }).parse(request.query);
    const values: unknown[] = [];
    const categoryFilter = category ? " AND c.slug = $1" : "";
    if (category) values.push(category);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT p.*, c.title AS category_title, c.slug AS category_slug,
        (p.sale_price_per_kg - p.purchase_price_per_kg) AS profit_per_kg,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.10)::bigint ELSE 0 END AS price_per_100g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.25)::bigint ELSE 0 END AS price_per_250g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.50)::bigint ELSE 0 END AS price_per_500g,
        CASE WHEN p.sale_type = 'weighted' THEN p.sale_price_per_kg ELSE 0 END AS price_per_1000g,
        CASE WHEN p.sale_type = 'packaged' THEN p.sale_price_per_kg ELSE 0 END AS package_price
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true AND c.is_active = true${categoryFilter}
       ORDER BY p.sort_order ASC, p.created_at ASC`,
      values
    );
    return { items: result.rows.map(toPublicRecord) };
  });

  app.get("/api/v1/products/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await pool.query<Record<string, unknown>>(
      `SELECT p.*, c.title AS category_title, c.slug AS category_slug,
        (p.sale_price_per_kg - p.purchase_price_per_kg) AS profit_per_kg,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.25)::bigint ELSE 0 END AS price_per_250g,
        CASE WHEN p.sale_type = 'weighted' THEN round(p.sale_price_per_kg * 0.50)::bigint ELSE 0 END AS price_per_500g,
        CASE WHEN p.sale_type = 'weighted' THEN p.sale_price_per_kg ELSE 0 END AS price_per_1000g,
        CASE WHEN p.sale_type = 'packaged' THEN p.sale_price_per_kg ELSE 0 END AS package_price
       FROM products p JOIN categories c ON c.id=p.category_id
       WHERE p.id=$1 AND p.is_active=true AND c.is_active=true`,
      [id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "محصول پیدا نشد." });
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return { item: toPublicRecord(result.rows[0]) };
  });

  app.get("/api/v1/product-images/:fileName", async (request, reply) => {
    const { fileName } = z.object({
      fileName: z.string().regex(/^[0-9a-f-]+\.(?:jpg|png|webp)$/)
    }).parse(request.params);
    const image = openProductImage(fileName);
    if (!image) return reply.code(404).send({ error: "تصویر محصول پیدا نشد." });
    reply.type(image.mime).header("Cache-Control", "public, max-age=31536000, immutable");
    return reply.send(image.stream);
  });

  app.get("/api/v1/payment-methods/active", async () => {
    const result = await pool.query<PaymentMethodRow>(
      `SELECT id,title,type,merchant_id
       FROM payment_methods
       WHERE is_active = true AND type IN ('cardToCard','zarinpal')
       ORDER BY CASE WHEN type = 'zarinpal' THEN 0 WHEN type = 'cardToCard' THEN 1 ELSE 2 END, created_at DESC`
    );
    if (!result.rows.length) return { item: null, methods: [] };

    const cards = await pool.query<Record<string, unknown>>(
      `SELECT id,payment_method_id,card_number,sheba_number,account_number,account_owner,bank_name
       FROM payment_cards WHERE is_active = true ORDER BY created_at`
    );
    const cardsByMethod = new Map<string, Record<string, unknown>[]>();
    cards.rows.forEach((card) => {
      const methodId = String(card.payment_method_id);
      cardsByMethod.set(methodId, [...(cardsByMethod.get(methodId) || []), card]);
    });

    const methods = result.rows.map((method) => ({
      id: method.id,
      title: method.title,
      type: method.type,
      merchantId: method.merchant_id,
      cards: (cardsByMethod.get(method.id) || []).map(toPublicRecord)
    }));
    const fallbackItem = methods.find((method) => method.type === "cardToCard") || methods[0] || null;
    return { item: fallbackItem, methods };
  });

  app.post("/api/v1/discounts/validate", async (request) => {
    const data = z.object({
      code: z.string().trim().min(3).max(60),
      totalAmount: z.number().int().min(0)
    }).parse(request.body);
    return orderService.validateDiscount(data.code, data.totalAmount);
  });

  app.post("/api/v1/orders", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const user = await getCurrentUser(request);
    const order = await orderService.create(request.body, user?.id ?? null);
    return reply.code(201).send({ order });
  });

  app.post("/api/v1/orders/card-transfer", {
    bodyLimit: 6 * 1024 * 1024,
    config: { rateLimit: { max: 8, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const part = await request.file();
    if (!part || part.fieldname !== "receipt") {
      return reply.code(422).send({ error: "تصویر فیش واریزی را انتخاب کنید." });
    }
    const buffer = await part.toBuffer();
    const payloadField = part.fields.payload;
    const rawPayload = payloadField && "value" in payloadField ? String(payloadField.value) : "";
    if (!rawPayload) return reply.code(422).send({ error: "اطلاعات سفارش کامل نیست." });

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      return reply.code(422).send({ error: "اطلاعات سفارش معتبر نیست." });
    }
    const saved = await savePaymentReceipt(buffer);
    try {
      const user = await getCurrentUser(request);
      const order = await orderService.create({ ...(parsedPayload as Record<string, unknown>), paymentReceiptUrl: saved.url }, user?.id ?? null);
      return reply.code(201).send({ order });
    } catch (error) {
      await removePaymentReceipt(saved.fileName);
      throw error;
    }
  });

  app.post("/api/v1/payments/zarinpal/request", { config: { rateLimit: { max: 8, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const data = z.object({ orderId: z.string().uuid() }).parse(request.body);
    const result = await pool.query<PaymentOrderRow>(
      `SELECT o.id,o.order_number,o.customer_name,o.customer_phone,o.final_amount,o.payment_status,
              o.payment_method_id,o.payment_authority,pm.type AS payment_type,pm.merchant_id
       FROM orders o JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = $1 LIMIT 1`,
      [data.orderId]
    );
    const order = result.rows[0];
    if (!order) return reply.code(404).send({ error: "سفارش پیدا نشد." });
    if (order.payment_type !== "zarinpal") return reply.code(400).send({ error: "روش پرداخت این سفارش زرین‌پال نیست." });
    if (order.payment_status === "paid") return reply.code(400).send({ error: "این سفارش قبلاً پرداخت شده است." });
    if (!order.merchant_id) return reply.code(400).send({ error: "کد پذیرنده زرین‌پال در پنل مدیریت ثبت نشده است." });

    const publicOrigin = getPublicOrigin(request);
    if (!getConfiguredPublicOrigin() && isLocalOrigin(publicOrigin)) {
      return reply.code(400).send({
        error: "زرین‌پال callback لوکال را قبول نمی‌کند. برای پرداخت واقعی PUBLIC_SITE_URL را برابر دامنه ثبت‌شده در زرین‌پال، مثل https://orenza.ir، تنظیم کنید."
      });
    }
    const callbackUrl = `${publicOrigin}/api/v1/payments/zarinpal/callback?orderId=${encodeURIComponent(order.id)}`;
    const amount = zarinpalAmount(Number(order.final_amount));
    const zarinpalResponse = await fetch("https://api.zarinpal.com/pg/v4/payment/request.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: order.merchant_id,
        amount,
        callback_url: callbackUrl,
        description: `پرداخت سفارش ${order.order_number} اورنزا`,
        metadata: { mobile: order.customer_phone }
      })
    });
    const payload = await zarinpalResponse.json() as { data?: { code?: number; authority?: string; message?: string }; errors?: unknown };
    const authority = payload.data?.authority;
    if (!zarinpalResponse.ok || payload.data?.code !== 100 || !authority) {
      request.log.warn({ zarinpal: payload, callbackUrl, orderId: order.id }, "zarinpal payment request failed");
      return reply.code(502).send({ error: zarinpalErrorMessage(payload) });
    }
    await orderService.markPaymentStarted(order.id, authority);
    return { authority, url: zarinpalStartUrl(authority) };
  });

  app.get("/api/v1/payments/zarinpal/callback", async (request, reply) => {
    const data = z.object({
      orderId: z.string().uuid(),
      Authority: z.string().trim().min(4).optional(),
      Status: z.string().trim().optional()
    }).parse(request.query);
    const redirectBase = `${getPublicOrigin(request)}/payment-result/`;
    const fail = async (reason: string, authority?: string) => {
      await orderService.markPaymentRejected(data.orderId, authority || data.Authority || null);
      return reply.redirect(`${redirectBase}?status=failed&reason=${encodeURIComponent(reason)}&order=${encodeURIComponent(data.orderId)}`);
    };
    if (data.Status !== "OK" || !data.Authority) return fail("پرداخت توسط کاربر لغو شد.");

    const result = await pool.query<PaymentOrderRow>(
      `SELECT o.id,o.order_number,o.final_amount,o.payment_status,o.payment_method_id,o.payment_authority,
              o.customer_name,o.customer_phone,pm.type AS payment_type,pm.merchant_id
       FROM orders o JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = $1 LIMIT 1`,
      [data.orderId]
    );
    const order = result.rows[0];
    if (!order) return reply.redirect(`${redirectBase}?status=failed&reason=${encodeURIComponent("سفارش پیدا نشد.")}`);
    if (order.payment_type !== "zarinpal" || !order.merchant_id) return fail("اطلاعات پرداخت سفارش کامل نیست.", data.Authority);

    const verifyResponse = await fetch("https://api.zarinpal.com/pg/v4/payment/verify.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: order.merchant_id,
        amount: zarinpalAmount(Number(order.final_amount)),
        authority: data.Authority
      })
    });
    const payload = await verifyResponse.json() as { data?: { code?: number; ref_id?: number | string; message?: string }; errors?: unknown };
    if (verifyResponse.ok && (payload.data?.code === 100 || payload.data?.code === 101)) {
      await orderService.markPaymentVerified(order.id, data.Authority, String(payload.data.ref_id || ""));
      return reply.redirect(`${redirectBase}?status=success&order=${encodeURIComponent(order.order_number)}&ref=${encodeURIComponent(String(payload.data.ref_id || ""))}`);
    }

    request.log.warn({ zarinpal: payload, orderId: order.id }, "zarinpal payment verify failed");
    return fail(zarinpalErrorMessage(payload) || "تأیید پرداخت ناموفق بود.", data.Authority);
  });

  app.post("/api/v1/analytics/visit", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const data = z.object({
      visitorId: z.string().uuid(),
      path: z.string().trim().min(1).max(300).regex(/^\/(?!\/)/)
    }).parse(request.body);
    await pool.query(
      `INSERT INTO site_visits (visitor_id,path) VALUES ($1,$2)
       ON CONFLICT (visitor_id,path,visited_on) DO NOTHING`,
      [data.visitorId, data.path.split("?")[0]]
    );
    return reply.code(204).send();
  });
};
