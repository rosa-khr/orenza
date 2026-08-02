import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import type { NewOrder } from "./order-notifications.js";

export type InvoiceBranding = {
  brandName: string;
  brandNameEn: string;
  supportPhone: string;
  supportEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  address: string;
  invoiceNationalId: string;
  invoiceSignature?: { data: Buffer; mime: string } | null;
};

const money = new Intl.NumberFormat("fa-IR");
const invoiceDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran"
});
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const shippingLabel = (value: string) => ({ post: "پست پیشتاز", tipax: "تیپاکس" })[value] || value;
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
const asMoney = (value: number | string | undefined) => `${money.format(Number(value || 0))} تومان`;

const assetRoot = () => {
  const candidates = [
    process.env.EMAIL_ASSET_DIR,
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "../public")
  ].filter((item): item is string => Boolean(item));
  return candidates.find((item) => existsSync(path.join(item, "fonts/Dana-Regular.ttf"))) || candidates[0]!;
};

export const readEmailBrandLogo = async () => {
  const root = assetRoot();
  const candidates = [
    path.join(root, "orenza-logo.png"),
    path.join(root, "images/orenza-logo.png")
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  if (!logoPath) throw new Error("Orenza email logo asset was not found");
  return readFile(logoPath);
};

const asDataUri = (data: Buffer, mime: string) => `data:${mime};base64,${data.toString("base64")}`;

const invoiceHtml = async (order: NewOrder, branding: InvoiceBranding) => {
  const root = assetRoot();
  const [regularFont, demiBoldFont, logoSvg] = await Promise.all([
    readFile(path.join(root, "fonts/Dana-Regular.ttf")),
    readFile(path.join(root, "fonts/Dana-DemiBold.ttf")),
    readFile(path.join(root, "favicon.svg"))
  ]);
  const signature = branding.invoiceSignature
    ? `<img src="${asDataUri(branding.invoiceSignature.data, branding.invoiceSignature.mime)}" alt="امضای فروشنده">`
    : `<span>محل مهر و امضای فروشنده</span>`;
  const rows = order.items.map((item, index) => `
    <tr>
      <td>${money.format(index + 1)}</td>
      <td class="product"><strong>${escapeHtml(item.productTitle)}</strong><small>${escapeHtml([
        item.roastType ? `رُست ${item.roastType}` : "",
        item.blendType,
        item.brewMethod || ""
      ].filter(Boolean).join(" · "))}</small></td>
      <td>${money.format(item.weight)} گرم</td>
      <td>${money.format(item.quantity)}</td>
      <td>${escapeHtml(item.grindType)}</td>
      <td>${asMoney(item.unitPrice)}</td>
      <td>${asMoney(item.totalPrice)}</td>
    </tr>`).join("");

  return `<!doctype html>
  <html lang="fa" dir="rtl">
    <head>
      <meta charset="utf-8">
      <style>
        @font-face { font-family:Dana; src:url('${asDataUri(regularFont, "font/ttf")}') format('truetype'); font-weight:400; }
        @font-face { font-family:Dana; src:url('${asDataUri(demiBoldFont, "font/ttf")}') format('truetype'); font-weight:600 800; }
        * { box-sizing:border-box; }
        @page { size:A4; margin:0; }
        html,body { margin:0; background:#f2ede4; color:#302c27; font-family:Dana,Tahoma,sans-serif; }
        body { padding:14mm; }
        .sheet { min-height:269mm; overflow:hidden; border-top:5px solid #173f30; border-radius:4px; background:#fffdf9; padding:12mm; box-shadow:0 8px 28px rgba(45,35,20,.08); }
        header { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:14px; border-bottom:2px solid #173f30; padding-bottom:14px; }
        .brand { display:flex; align-items:center; gap:10px; direction:ltr; }
        .brand img { width:46px; height:46px; }
        .brand div { display:grid; }
        .brand strong { color:#173f30; font-size:16px; letter-spacing:3px; }
        .brand small { color:#9b8158; font-size:7px; letter-spacing:1.4px; }
        .title { text-align:center; }
        .title small { color:#a57735; font-size:8px; letter-spacing:1px; }
        .title h1 { margin:3px 0 0; color:#173f30; font-size:19px; }
        .meta { display:grid; gap:6px; font-size:9px; }
        .meta div { display:flex; justify-content:flex-start; gap:8px; }
        .meta span { color:#82786b; }
        .meta strong { direction:ltr; }
        .parties { display:grid; gap:10px; margin-top:14px; }
        .party { overflow:hidden; border:1px solid #ddd2c1; border-radius:6px; }
        .party h2 { display:flex; justify-content:space-between; margin:0; background:#f1e8d9; padding:7px 10px; color:#173f30; font-size:10px; }
        .party h2 small { color:#9b8769; font-size:6px; letter-spacing:1px; }
        .party-grid { display:grid; grid-template-columns:repeat(4,1fr); }
        .field { min-height:49px; border-left:1px solid #eee5d8; padding:8px 10px; }
        .field:last-child { border-left:0; }
        .field.wide { grid-column:span 2; }
        .field span { display:block; margin-bottom:4px; color:#82796d; font-size:7px; }
        .field strong { font-size:9px; line-height:1.65; }
        table { width:100%; margin-top:14px; border-collapse:collapse; table-layout:fixed; font-size:8px; }
        th,td { border:1px solid #ddd3c4; padding:8px 5px; text-align:center; }
        th { background:#173f30; color:#fff; font-weight:600; }
        tbody tr:nth-child(even) { background:#faf6ef; }
        th:nth-child(1),td:nth-child(1) { width:5%; }
        th:nth-child(2),td:nth-child(2) { width:28%; }
        th:nth-child(3),td:nth-child(3) { width:11%; }
        th:nth-child(4),td:nth-child(4) { width:8%; }
        th:nth-child(5),td:nth-child(5) { width:14%; }
        th:nth-child(6),td:nth-child(6),th:nth-child(7),td:nth-child(7) { width:17%; }
        td.product { text-align:right; }
        td.product strong,td.product small { display:block; }
        td.product small { margin-top:3px; color:#766d62; font-size:6px; line-height:1.6; }
        .closing { display:grid; grid-template-columns:1fr 42%; gap:12px; margin-top:14px; }
        .signature,.summary { overflow:hidden; border:1px solid #d9cebd; border-radius:6px; }
        .signature { display:grid; min-height:137px; grid-template-rows:auto 1fr auto; padding:9px 12px; }
        .signature header { display:flex; justify-content:space-between; border:0; padding:0; color:#173f30; font-size:8px; font-weight:600; }
        .signature header small { color:#9b8b72; font-size:6px; }
        .signature .image { display:grid; min-height:82px; place-items:center; color:#aaa092; font-size:7px; }
        .signature img { max-width:180px; max-height:80px; object-fit:contain; }
        .signature > strong { border-top:1px dashed #d8cebd; padding-top:5px; color:#6e6559; text-align:center; font-size:8px; }
        .summary div { display:flex; justify-content:space-between; border-bottom:1px solid #e8dfd2; padding:7px 10px; font-size:8px; }
        .summary div:last-child { border:0; }
        .summary .grand { align-items:center; background:#173f30; color:#fff; }
        .summary .grand strong { font-size:12px; }
        footer { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:14px; border-top:1px solid #cdbfa9; background:linear-gradient(90deg,#f7f1e7,#fffdf8); padding:10px 12px; }
        footer div { display:grid; gap:2px; }
        footer strong { color:#173f30; font-size:8px; }
        footer span,footer a { color:#746b60; font-size:6.5px; line-height:1.7; text-decoration:none; }
        .contacts { direction:ltr; text-align:left; }
      </style>
    </head>
    <body>
      <main class="sheet">
        <header>
          <div class="brand"><img src="${asDataUri(logoSvg, "image/svg+xml")}" alt="Orenza"><div><strong>${escapeHtml(branding.brandNameEn || "ORENZA")}</strong><small>COFFEE ROASTERS</small></div></div>
          <div class="title"><small>صورتحساب فروش کالا</small><h1>فاکتور رسمی فروش</h1></div>
          <div class="meta"><div><span>شماره فاکتور</span><strong>${escapeHtml(order.orderNumber)}</strong></div><div><span>تاریخ صدور</span><strong>${escapeHtml(invoiceDate.format(new Date(order.createdAt)))}</strong></div></div>
        </header>
        <section class="parties">
          <article class="party"><h2><span>اطلاعات فروشنده</span><small>SELLER INFORMATION</small></h2><div class="party-grid">
            <div class="field"><span>نام مجموعه</span><strong>${escapeHtml(branding.brandName)}</strong></div>
            <div class="field"><span>شناسه ملی</span><strong>${escapeHtml(branding.invoiceNationalId)}</strong></div>
            <div class="field"><span>شماره تماس</span><strong>${escapeHtml(branding.supportPhone || "—")}</strong></div>
            <div class="field"><span>ایمیل</span><strong>${escapeHtml(branding.supportEmail || "—")}</strong></div>
            <div class="field wide"><span>نشانی فروشنده</span><strong>${escapeHtml(branding.address || "—")}</strong></div>
            <div class="field wide"><span>وب‌سایت</span><strong>${escapeHtml(branding.websiteUrl || "https://orenza.ir")}</strong></div>
          </div></article>
          <article class="party"><h2><span>اطلاعات خریدار</span><small>BUYER INFORMATION</small></h2><div class="party-grid">
            <div class="field"><span>نام خریدار</span><strong>${escapeHtml(order.customerName)}</strong></div>
            <div class="field"><span>شماره تماس</span><strong>${escapeHtml(order.customerPhone)}</strong></div>
            <div class="field"><span>کدپستی</span><strong>${escapeHtml(order.customerPostalCode)}</strong></div>
            <div class="field"><span>روش ارسال</span><strong>${escapeHtml(shippingLabel(order.shippingMethod))}</strong></div>
            <div class="field wide"><span>نشانی تحویل</span><strong>${escapeHtml(`${order.customerProvince}، ${order.customerCity}، ${order.customerAddress}`)}</strong></div>
            <div class="field"><span>روش پرداخت</span><strong>${escapeHtml(order.paymentMethodTitle || "—")}</strong></div>
            <div class="field"><span>وضعیت پرداخت</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></div>
            <div class="field"><span>وضعیت سفارش</span><strong>${escapeHtml(orderStatusLabel(order.orderStatus))}</strong></div>
            <div class="field"><span>کد پیگیری پرداخت</span><strong>${escapeHtml(order.paymentRefId || "—")}</strong></div>
            ${order.customerNote ? `<div class="field wide"><span>یادداشت مشتری</span><strong>${escapeHtml(order.customerNote)}</strong></div>` : ""}
          </div></article>
        </section>
        <table><thead><tr><th>ردیف</th><th>شرح کالا</th><th>وزن</th><th>تعداد</th><th>نوع آسیاب</th><th>مبلغ واحد</th><th>مبلغ کل</th></tr></thead><tbody>${rows}</tbody></table>
        <section class="closing">
          <div class="signature"><header><span>مهر و امضای فروشنده</span><small>SELLER SIGNATURE</small></header><div class="image">${signature}</div><strong>${escapeHtml(branding.brandName)}</strong></div>
          <div class="summary">
            <div><span>جمع مبلغ اقلام</span><strong>${asMoney(order.totalAmount)}</strong></div>
            <div><span>تخفیف</span><strong>${asMoney(order.discountAmount)}</strong></div>
            <div><span>مالیات ارزش افزوده ۱۰٪</span><strong>${asMoney(order.taxAmount)}</strong></div>
            <div class="grand"><span>مبلغ قابل پرداخت</span><strong>${asMoney(order.finalAmount)}</strong></div>
          </div>
        </section>
        <footer><div><strong>کیفیت اتفاقی نیست؛ حاصل دقت در انتخاب است.</strong><span>از اعتماد، همراهی و انتخاب ارزشمند شما سپاسگزاریم.</span></div><div class="contacts"><a>${escapeHtml(branding.supportPhone)}</a><a>${escapeHtml(branding.supportEmail)}</a><a>${escapeHtml(branding.instagramUrl)}</a><a>${escapeHtml(branding.websiteUrl)}</a></div></footer>
      </main>
    </body>
  </html>`;
};

export const createInvoicePdf = async (order: NewOrder, branding: InvoiceBranding) => {
  const remoteUrl = process.env.CHROMIUM_REMOTE_URL?.replace(/\/+$/, "");
  const remoteTarget = remoteUrl ? new URL(remoteUrl) : null;
  if (remoteTarget && !/^\d+(?:\.\d+){3}$/.test(remoteTarget.hostname)) {
    remoteTarget.hostname = (await lookup(remoteTarget.hostname, { family: 4 })).address;
  }
  const remoteVersion = remoteTarget
    ? await fetch(new URL("/json/version", remoteTarget)).then(async (response) => {
      if (!response.ok) throw new Error(`Remote Chromium returned ${response.status}`);
      return response.json() as Promise<{ webSocketDebuggerUrl: string }>;
    })
    : null;
  const browser = remoteVersion?.webSocketDebuggerUrl
    ? await puppeteer.connect({ browserWSEndpoint: remoteVersion.webSocketDebuggerUrl })
    : await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
  try {
    const page = await browser.newPage();
    await page.setContent(await invoiceHtml(order, branding), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdf);
  } finally {
    if (remoteVersion) await browser.disconnect();
    else await browser.close();
  }
};
