import { sendOrderEmail, type NewOrder } from "./order-notifications.js";

const recipient = process.env.ORDER_NOTIFICATION_EMAIL?.trim();
if (!recipient) {
  throw new Error("ORDER_NOTIFICATION_EMAIL is required for the email test.");
}

const sampleOrder: NewOrder = {
  id: "local-email-test",
  orderNumber: `TEST-${Date.now()}`,
  customerName: "مشتری آزمایشی اورنزا",
  customerPhone: "۰۹۱۲۱۲۳۴۵۶۷",
  customerAddress: "نشانی آزمایشی برای بررسی قالب ایمیل",
  customerProvince: "تهران",
  customerCity: "تهران",
  customerPostalCode: "۱۲۳۴۵۶۷۸۹۰",
  shippingMethod: "ارسال با پست پیشتاز",
  paymentMethodId: "test-card-transfer",
  paymentMethodTitle: "کارت‌به‌کارت",
  paymentRefId: "TEST-TRACKING-123",
  paymentReceiptUrl: "/api/v1/admin/payment-receipts/test.png",
  paymentStatus: "pending",
  orderStatus: "new",
  customerNote: "لطفاً سفارش با بسته‌بندی مناسب ارسال شود.",
  totalAmount: 1_350_000,
  discountAmount: 0,
  taxAmount: 135_000,
  finalAmount: 1_485_000,
  createdAt: new Date(),
  items: [
    {
      productTitle: "اسپرسو ۹۰ روبوستا",
      weight: 500,
      quantity: 2,
      grindType: "آسیاب‌شده",
      roastType: "مدیوم دارک",
      blendType: "ترکیب اختصاصی",
      brewMethod: "اسپرسوساز",
      unitPrice: 675_000,
      totalPrice: 1_350_000
    }
  ]
};

const testReceipt = {
  data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  mime: "image/png",
  extension: "png"
};
const sent = await sendOrderEmail(recipient, sampleOrder, undefined, testReceipt);
if (!sent) {
  throw new Error("SMTP_HOST is required for the email test.");
}

console.log(`Test order email sent to ${recipient}.`);
