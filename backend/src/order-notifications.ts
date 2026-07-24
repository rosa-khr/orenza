import nodemailer from "nodemailer";
import type { Pool } from "pg";

type OrderItem = {
  productTitle: string;
  weight: number;
  quantity: number;
  grindType: string;
  roastType: string;
  blendType: string;
  brewMethod?: string | null;
  totalPrice: number;
};

export type NewOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerProvince: string;
  customerCity: string;
  customerPostalCode: string;
  shippingMethod: string;
  paymentRefId?: string | null;
  finalAmount: number | string;
  createdAt: string | Date;
  items: OrderItem[];
};

const money = new Intl.NumberFormat("fa-IR");
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const itemLabel = (item: OrderItem) =>
  [
    item.productTitle,
    `${money.format(item.weight)} گرم`,
    `${money.format(item.quantity)} عدد`,
    item.roastType ? `رُست ${item.roastType}` : "",
    item.grindType,
    item.brewMethod || ""
  ].filter(Boolean).join(" · ");

const orderAdminUrl = (order: NewOrder) => {
  const origin = (process.env.PUBLIC_SITE_URL || "https://orenza.ir").replace(/\/+$/, "");
  return `${origin}/admin/orders/view/?id=${encodeURIComponent(order.id)}`;
};

const readNotificationEmail = async (pool: Pool) => {
  if (process.env.ORDER_NOTIFICATION_EMAIL?.trim()) {
    return process.env.ORDER_NOTIFICATION_EMAIL.trim();
  }
  const result = await pool.query<{ support_email: string }>(
    "SELECT support_email FROM site_settings WHERE id=1"
  );
  return result.rows[0]?.support_email || null;
};

const sendEmailNotification = async (pool: Pool, order: NewOrder) => {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  const recipient = await readNotificationEmail(pool);
  if (!recipient) return false;

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  const items = order.items.map((item) =>
    `<li style="margin:0 0 8px">${escapeHtml(itemLabel(item))} — ${money.format(Number(item.totalPrice))} تومان</li>`
  ).join("");
  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || user,
    to: recipient,
    subject: `سفارش جدید اورنزا — ${order.orderNumber}`,
    text: [
      `سفارش جدید ${order.orderNumber}`,
      `مشتری: ${order.customerName}`,
      `تلفن: ${order.customerPhone}`,
      `مبلغ نهایی: ${money.format(Number(order.finalAmount))} تومان`,
      `ارسال: ${order.shippingMethod}`,
      `نشانی: ${order.customerProvince}، ${order.customerCity}، ${order.customerAddress}`,
      order.paymentRefId ? `کد پیگیری پرداخت: ${order.paymentRefId}` : "",
      "",
      ...order.items.map((item) => `- ${itemLabel(item)} — ${money.format(Number(item.totalPrice))} تومان`),
      "",
      `مشاهده سفارش: ${orderAdminUrl(order)}`
    ].filter(Boolean).join("\n"),
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#24352d">
        <h2 style="margin:0 0 16px">سفارش جدید اورنزا</h2>
        <p><strong>شماره سفارش:</strong> ${escapeHtml(order.orderNumber)}</p>
        <p><strong>مشتری:</strong> ${escapeHtml(order.customerName)} · ${escapeHtml(order.customerPhone)}</p>
        <p><strong>نشانی:</strong> ${escapeHtml(`${order.customerProvince}، ${order.customerCity}، ${order.customerAddress}`)}</p>
        <p><strong>روش ارسال:</strong> ${escapeHtml(order.shippingMethod)}</p>
        ${order.paymentRefId ? `<p><strong>کد پیگیری پرداخت:</strong> ${escapeHtml(order.paymentRefId)}</p>` : ""}
        <ul style="padding-right:20px">${items}</ul>
        <p style="font-size:18px"><strong>مبلغ نهایی: ${money.format(Number(order.finalAmount))} تومان</strong></p>
        <p><a href="${escapeHtml(orderAdminUrl(order))}" style="color:#1d4c3a">مشاهده سفارش در پنل مدیریت</a></p>
      </div>`
  });
  return true;
};

const sendTelegramNotification = async (order: NewOrder) => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ORDER_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const itemLines = order.items.map((item) =>
    `• ${escapeHtml(itemLabel(item))}\n  ${money.format(Number(item.totalPrice))} تومان`
  ).join("\n");
  const text = [
    "🛍 <b>سفارش جدید اورنزا</b>",
    "",
    `<b>شماره:</b> <code>${escapeHtml(order.orderNumber)}</code>`,
    `<b>مشتری:</b> ${escapeHtml(order.customerName)}`,
    `<b>تلفن:</b> <code>${escapeHtml(order.customerPhone)}</code>`,
    `<b>ارسال:</b> ${escapeHtml(order.shippingMethod)}`,
    order.paymentRefId ? `<b>کد پیگیری:</b> <code>${escapeHtml(order.paymentRefId)}</code>` : "",
    "",
    itemLines,
    "",
    `<b>مبلغ نهایی:</b> ${money.format(Number(order.finalAmount))} تومان`,
    `<a href="${escapeHtml(orderAdminUrl(order))}">مشاهده در پنل مدیریت</a>`
  ].filter(Boolean).join("\n");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true }
    }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { description?: string };
    throw new Error(payload.description || `Telegram API returned ${response.status}`);
  }
  return true;
};

export const notifyNewOrder = async (pool: Pool, order: NewOrder) => {
  const results = await Promise.allSettled([
    sendEmailNotification(pool, order),
    sendTelegramNotification(order)
  ]);
  const channels = ["email", "telegram"];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error({
        event: "new_order_notification_failed",
        channel: channels[index],
        orderNumber: order.orderNumber,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
    }
  });
};
