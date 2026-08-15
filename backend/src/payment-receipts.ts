import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const receiptDirectory = process.env.PAYMENT_RECEIPT_DIR || path.resolve(process.cwd(), "data/payment-receipts");
const maxReceiptSize = 1 * 1024 * 1024;

const formats = [
  { mime: "image/jpeg", extension: "jpg", matches: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  { mime: "image/png", extension: "png", matches: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", extension: "webp", matches: (buffer: Buffer) => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" }
];

export const savePaymentReceipt = async (buffer: Buffer) => {
  if (buffer.length > maxReceiptSize) {
    throw Object.assign(new Error("حجم تصویر فیش نباید بیشتر از ۱ مگابایت باشد."), { statusCode: 422 });
  }
  const format = formats.find((item) => item.matches(buffer));
  if (!format) {
    throw Object.assign(new Error("فیش باید تصویر JPG، PNG یا WebP معتبر باشد."), { statusCode: 422 });
  }
  await mkdir(receiptDirectory, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${format.extension}`;
  await writeFile(path.join(receiptDirectory, fileName), buffer, { flag: "wx", mode: 0o600 });
  return { fileName, mime: format.mime, url: `/api/v1/admin/payment-receipts/${fileName}` };
};

export const removePaymentReceipt = async (fileName: string) => {
  await unlink(path.join(receiptDirectory, path.basename(fileName))).catch(() => undefined);
};

export const openPaymentReceipt = (fileName: string) => {
  const safeName = path.basename(fileName);
  if (safeName !== fileName || !/^[0-9a-f-]+\.(?:jpg|png|webp)$/.test(safeName)) return null;
  const extension = path.extname(safeName).slice(1);
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  return { stream: createReadStream(path.join(receiptDirectory, safeName)), mime };
};

export const readPaymentReceipt = async (fileName: string) => {
  const safeName = path.basename(fileName);
  if (safeName !== fileName || !/^[0-9a-f-]+\.(?:jpg|png|webp)$/.test(safeName)) return null;
  const extension = path.extname(safeName).slice(1);
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const data = await readFile(path.join(receiptDirectory, safeName)).catch(() => null);
  return data ? { data, mime, extension } : null;
};
