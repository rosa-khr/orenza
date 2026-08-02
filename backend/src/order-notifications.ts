import nodemailer from "nodemailer";
import type { Pool } from "pg";
import { createInvoicePdf, readEmailBrandLogo, type InvoiceBranding } from "./invoice-pdf.js";
import { readInvoiceSignature } from "./invoice-signatures.js";
import { readPaymentReceipt } from "./payment-receipts.js";

type OrderItem = {
  productTitle: string;
  weight: number;
  quantity: number;
  grindType: string;
  roastType: string;
  blendType: string;
  brewMethod?: string | null;
  unitPrice: number;
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
  paymentMethodId?: string | null;
  paymentMethodTitle?: string | null;
  paymentRefId?: string | null;
  paymentReceiptUrl?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  customerNote?: string | null;
  totalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  finalAmount: number | string;
  createdAt: string | Date;
  items: OrderItem[];
};

const money = new Intl.NumberFormat("fa-IR");
const orderDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran"
});
const shippingLabel = (value: string) => ({
  post: "پست پیشتاز",
  tipax: "تیپاکس"
})[value] || value;
const paymentStatusLabel = (value?: string | null) => ({
  pending: "در انتظار تأیید پرداخت",
  paid: "پرداخت‌شده",
  rejected: "ردشده"
})[value || ""] || value || "—";
const orderStatusLabel = (value?: string | null) => ({
  new: "سفارش جدید",
  processing: "در حال آماده‌سازی",
  ready: "آماده ارسال",
  sent: "ارسال‌شده",
  completed: "تکمیل‌شده",
  canceled: "لغوشده"
})[value || ""] || value || "—";
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

const defaultBranding: InvoiceBranding = {
  brandName: "اورنزا",
  brandNameEn: "ORENZA",
  supportPhone: "09103060396",
  supportEmail: "order.orenzacoffee@gmail.com",
  websiteUrl: "https://orenza.ir",
  instagramUrl: "https://instagram.com/orenza.ir",
  address: "",
  invoiceNationalId: "۰۰۲۱۴۱۱۴۱۷"
};

const readNotificationSettings = async (pool: Pool, order: NewOrder) => {
  const [result, paymentResult] = await Promise.all([pool.query<{
    brand_name: string;
    brand_name_en: string;
    support_phone: string;
    support_email: string;
    website_url: string;
    instagram_url: string;
    address: string | null;
    invoice_national_id: string;
    invoice_signature_url: string | null;
  }>(`SELECT brand_name,brand_name_en,support_phone,support_email,website_url,
             instagram_url,address,invoice_national_id,invoice_signature_url
        FROM site_settings WHERE id=1`), pool.query<{ title: string }>(
    `SELECT pm.title FROM orders o
       JOIN payment_methods pm ON pm.id=o.payment_method_id
      WHERE o.id=$1 LIMIT 1`,
    [order.id]
  )]);
  const settings = result.rows[0];
  const signatureFileName = settings?.invoice_signature_url?.split("/").pop();
  return {
    recipient: process.env.ORDER_NOTIFICATION_EMAIL?.trim() || settings?.support_email || null,
    paymentMethodTitle: paymentResult.rows[0]?.title || null,
    branding: {
      brandName: settings?.brand_name || defaultBranding.brandName,
      brandNameEn: settings?.brand_name_en || defaultBranding.brandNameEn,
      supportPhone: settings?.support_phone || defaultBranding.supportPhone,
      supportEmail: settings?.support_email || defaultBranding.supportEmail,
      websiteUrl: settings?.website_url || defaultBranding.websiteUrl,
      instagramUrl: settings?.instagram_url || defaultBranding.instagramUrl,
      address: settings?.address || "",
      invoiceNationalId: settings?.invoice_national_id || defaultBranding.invoiceNationalId,
      invoiceSignature: signatureFileName ? await readInvoiceSignature(signatureFileName) : null
    } satisfies InvoiceBranding
  };
};

export const sendOrderEmail = async (
  recipient: string,
  order: NewOrder,
  branding: InvoiceBranding = defaultBranding,
  paymentReceipt: { data: Buffer; mime: string; extension: string } | null = null
) => {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if (!host) return false;

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000
  });
  const tableRows = order.items.map((item) => `
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid #eee5d8;text-align:right">
        <strong style="display:block;color:#173f30">${escapeHtml(item.productTitle)}</strong>
        <span style="color:#817568;font-size:11px">${escapeHtml(itemLabel(item))}</span>
      </td>
      <td style="padding:9px 10px;border-bottom:1px solid #eee5d8;text-align:center;white-space:nowrap">${money.format(item.quantity)}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #eee5d8;text-align:left;white-space:nowrap">${money.format(Number(item.totalPrice))} تومان</td>
    </tr>`).join("");
  const [invoicePdf, brandLogo] = await Promise.all([
    createInvoicePdf(order, branding),
    readEmailBrandLogo()
  ]);
  const logoCid = `orenza-logo-${order.id}@orenza`;
  const receiptCid = paymentReceipt ? `payment-receipt-${order.id}@orenza` : undefined;
  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || user || recipient,
    to: recipient,
    subject: `سفارش جدید اورنزا — ${order.orderNumber}`,
    text: [
      `سفارش جدید ${order.orderNumber}`,
      `مشتری: ${order.customerName}`,
      `تلفن: ${order.customerPhone}`,
      `تاریخ ثبت: ${orderDate.format(new Date(order.createdAt))}`,
      `وضعیت سفارش: ${orderStatusLabel(order.orderStatus)}`,
      `روش پرداخت: ${order.paymentMethodTitle || "—"}`,
      `وضعیت پرداخت: ${paymentStatusLabel(order.paymentStatus)}`,
      `جمع اقلام: ${money.format(Number(order.totalAmount))} تومان`,
      `تخفیف: ${money.format(Number(order.discountAmount))} تومان`,
      `مالیات: ${money.format(Number(order.taxAmount))} تومان`,
      `مبلغ نهایی: ${money.format(Number(order.finalAmount))} تومان`,
      `روش ارسال: ${shippingLabel(order.shippingMethod)}`,
      `نشانی: ${order.customerProvince}، ${order.customerCity}، ${order.customerAddress}`,
      `کدپستی: ${order.customerPostalCode}`,
      order.paymentRefId ? `کد پیگیری پرداخت: ${order.paymentRefId}` : "",
      order.customerNote ? `یادداشت مشتری: ${order.customerNote}` : "",
      "",
      ...order.items.map((item) => `- ${itemLabel(item)} — ${money.format(Number(item.totalPrice))} تومان`),
      "",
      "فاکتور رسمی PDF این سفارش به ایمیل پیوست شده است.",
      paymentReceipt ? "تصویر فیش واریزی نیز به ایمیل پیوست شده است." : "",
      `مشاهده سفارش: ${orderAdminUrl(order)}`
    ].filter(Boolean).join("\n"),
    html: `
      <style>
        .orenza-email, .orenza-email * { font-family:'Dana',Tahoma,Arial,sans-serif !important; }
        .orenza-email { font-size:13px; line-height:1.75; }
        .orenza-email strong { font-weight:600; }
        @media only screen and (max-width:600px) {
          .orenza-email { padding:10px !important; }
          .orenza-email-content { padding:18px 14px !important; }
          .orenza-email-header { padding:18px 16px !important; }
        }
      </style>
      <div class="orenza-email" dir="rtl" style="margin:0;background:#f3eee6;padding:20px 10px;font-family:'Dana',Tahoma,Arial,sans-serif;font-size:13px;line-height:1.75;color:#302c27">
        <div style="max-width:680px;margin:auto;overflow:hidden;border-radius:16px;background:#fffdf9;box-shadow:0 8px 30px rgba(52,38,21,.10)">
          <div class="orenza-email-header" style="background:#1e1d1a;padding:20px 24px;color:#fff">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;direction:ltr">
              <div style="display:flex;align-items:center;gap:10px">
                <img src="cid:${logoCid}" width="46" height="46" alt="Orenza" style="display:block;border:0;background:transparent">
                <div><strong style="display:block;color:#e2c58d;font-size:17px;line-height:1.4;letter-spacing:3px">${escapeHtml(branding.brandNameEn)}</strong><span style="color:#a9987c;font-size:9px;letter-spacing:1.5px">COFFEE ROASTERS</span></div>
              </div>
              <span style="direction:rtl;color:#d8c9b2;font-size:12px">سفارش جدید ثبت شد</span>
            </div>
          </div>
          <div class="orenza-email-content" style="padding:22px 24px">
            <div style="margin-bottom:16px;border-right:3px solid #b88a42;padding-right:12px">
              <span style="color:#8e806d;font-size:11px">شماره سفارش</span>
              <h1 style="margin:2px 0;color:#173f30;font-size:19px;line-height:1.5;direction:ltr;text-align:right">${escapeHtml(order.orderNumber)}</h1>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
              <div style="border:1px solid #e5dbc9;border-radius:9px;background:#faf6ef;padding:10px"><span style="display:block;color:#897d6e;font-size:10px">مشتری</span><strong>${escapeHtml(order.customerName)}</strong></div>
              <div style="border:1px solid #e5dbc9;border-radius:9px;background:#faf6ef;padding:10px"><span style="display:block;color:#897d6e;font-size:10px">شماره تماس</span><strong style="direction:ltr">${escapeHtml(order.customerPhone)}</strong></div>
              <div style="border:1px solid #e5dbc9;border-radius:9px;background:#faf6ef;padding:10px"><span style="display:block;color:#897d6e;font-size:10px">تاریخ ثبت</span><strong>${escapeHtml(orderDate.format(new Date(order.createdAt)))}</strong></div>
              <div style="border:1px solid #e5dbc9;border-radius:9px;background:#faf6ef;padding:10px"><span style="display:block;color:#897d6e;font-size:10px">وضعیت سفارش</span><strong>${escapeHtml(orderStatusLabel(order.orderStatus))}</strong></div>
              <div style="grid-column:1/-1;border:1px solid #e5dbc9;border-radius:10px;background:#faf6ef;padding:12px"><span style="display:block;color:#897d6e;font-size:11px">نشانی و روش ارسال</span><strong>${escapeHtml(`${order.customerProvince}، ${order.customerCity}، ${order.customerAddress}`)}</strong><br><span style="color:#746b60;font-size:12px">${escapeHtml(shippingLabel(order.shippingMethod))} · کدپستی ${escapeHtml(order.customerPostalCode)}</span></div>
              <div style="border:1px solid #e5dbc9;border-radius:10px;background:#faf6ef;padding:12px"><span style="display:block;color:#897d6e;font-size:11px">روش پرداخت</span><strong>${escapeHtml(order.paymentMethodTitle || "—")}</strong></div>
              <div style="border:1px solid #e5dbc9;border-radius:10px;background:#faf6ef;padding:12px"><span style="display:block;color:#897d6e;font-size:11px">وضعیت پرداخت</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></div>
              ${order.paymentRefId ? `<div style="grid-column:1/-1;border:1px solid #e5dbc9;border-radius:10px;background:#faf6ef;padding:12px"><span style="display:block;color:#897d6e;font-size:11px">کد پیگیری پرداخت</span><strong>${escapeHtml(order.paymentRefId)}</strong></div>` : ""}
              ${order.customerNote ? `<div style="grid-column:1/-1;border:1px solid #e5dbc9;border-radius:10px;background:#faf6ef;padding:12px"><span style="display:block;color:#897d6e;font-size:11px">یادداشت مشتری</span><strong>${escapeHtml(order.customerNote)}</strong></div>` : ""}
            </div>
            <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #ded3c2;border-radius:10px;font-size:12px">
              <thead><tr style="background:#173f30;color:#fff"><th style="padding:8px 10px;text-align:right">محصول</th><th style="padding:8px 10px;text-align:center">تعداد</th><th style="padding:8px 10px;text-align:left">مبلغ</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
            <div style="margin-top:18px;overflow:hidden;border:1px solid #ded3c2;border-radius:12px">
              <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #eee5d8"><span>جمع اقلام</span><strong>${money.format(Number(order.totalAmount))} تومان</strong></div>
              <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #eee5d8"><span>تخفیف</span><strong>${money.format(Number(order.discountAmount))} تومان</strong></div>
              <div style="display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #eee5d8"><span>مالیات ارزش افزوده</span><strong>${money.format(Number(order.taxAmount))} تومان</strong></div>
              <div style="background:#173f30;padding:11px 16px;color:#fff;text-align:center"><span style="display:block;color:#b9c9c2;font-size:10px">مبلغ نهایی سفارش</span><strong style="font-size:18px">${money.format(Number(order.finalAmount))} تومان</strong></div>
            </div>
            ${paymentReceipt && receiptCid ? `<div style="margin-top:18px;border:1px solid #ded3c2;border-radius:12px;background:#faf6ef;padding:14px;text-align:center"><strong style="display:block;margin-bottom:10px;color:#173f30">تصویر فیش واریزی مشتری</strong><img src="cid:${receiptCid}" alt="فیش واریزی" style="display:block;max-width:100%;max-height:420px;margin:auto;border-radius:8px;border:1px solid #e0d5c5"></div>` : ""}
            <p style="margin:16px 0 0;color:#70675d;text-align:center;font-size:12px">فاکتور رسمی این سفارش با شناسه ملی ${escapeHtml(branding.invoiceNationalId)} به‌صورت PDF پیوست شده است.${paymentReceipt ? " تصویر فیش واریزی نیز در پیوست‌های ایمیل قرار دارد." : ""}</p>
            <p style="margin:16px 0 0;text-align:center"><a href="${escapeHtml(orderAdminUrl(order))}" style="display:inline-block;border-radius:8px;background:#b88a42;padding:9px 18px;color:#fff;text-decoration:none;font-size:12px;font-weight:600">مشاهده سفارش در پنل مدیریت</a></p>
          </div>
          <div style="border-top:1px solid #e6dccd;background:#f8f3ea;padding:14px 20px;text-align:center"><strong style="display:block;color:#173f30;font-size:12px">کیفیت اتفاقی نیست؛ حاصل دقت در انتخاب است.</strong><span style="color:#7e7467;font-size:11px">از اعتماد، همراهی و انتخاب ارزشمند شما سپاسگزاریم.</span></div>
        </div>
      </div>`,
    attachments: [
      {
        filename: `invoice-${order.orderNumber}.pdf`,
        content: invoicePdf,
        contentType: "application/pdf"
      },
      ...(paymentReceipt ? [{
        filename: `payment-receipt-${order.orderNumber}.${paymentReceipt.extension}`,
        content: paymentReceipt.data,
        contentType: paymentReceipt.mime,
        cid: receiptCid,
        contentDisposition: "attachment" as const
      }] : []),
      {
        filename: "orenza-logo.png",
        content: brandLogo,
        contentType: "image/png",
        cid: logoCid,
        contentDisposition: "inline"
      }
    ]
  });
  return true;
};

const sendEmailNotification = async (pool: Pool, order: NewOrder) => {
  const { recipient, branding, paymentMethodTitle } = await readNotificationSettings(pool, order);
  if (!recipient) return false;
  const enrichedOrder = { ...order, paymentMethodTitle };
  const receiptFileName = order.paymentReceiptUrl?.split("/").pop();
  const paymentReceipt = receiptFileName ? await readPaymentReceipt(receiptFileName) : null;
  return sendOrderEmail(recipient, enrichedOrder, branding, paymentReceipt);
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
    `<b>ارسال:</b> ${escapeHtml(shippingLabel(order.shippingMethod))}`,
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
    } else if (result.value) {
      console.info({
        event: "new_order_notification_sent",
        channel: channels[index],
        orderNumber: order.orderNumber
      });
    }
  });
};
