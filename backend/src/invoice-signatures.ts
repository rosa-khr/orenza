import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const signatureDirectory =
  process.env.INVOICE_SIGNATURE_DIR || path.resolve(process.cwd(), "data/invoice-signatures");

const formats = [
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (buffer: Buffer) =>
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    mime: "image/png",
    extension: "png",
    matches: (buffer: Buffer) =>
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (buffer: Buffer) =>
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
  }
];

export const saveInvoiceSignature = async (buffer: Buffer) => {
  const format = formats.find((item) => item.matches(buffer));
  if (!format) {
    throw Object.assign(new Error("امضا باید تصویر JPG، PNG یا WebP معتبر باشد."), {
      statusCode: 422
    });
  }
  await mkdir(signatureDirectory, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${format.extension}`;
  await writeFile(path.join(signatureDirectory, fileName), buffer, { flag: "wx", mode: 0o600 });
  return {
    fileName,
    url: `/api/v1/admin/invoice-signatures/${fileName}`
  };
};

export const removeInvoiceSignature = async (fileName: string) => {
  await unlink(path.join(signatureDirectory, path.basename(fileName))).catch(() => undefined);
};

export const openInvoiceSignature = (fileName: string) => {
  const safeName = path.basename(fileName);
  if (safeName !== fileName || !/^[0-9a-f-]+\.(?:jpg|png|webp)$/.test(safeName)) return null;
  const extension = path.extname(safeName).slice(1);
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  return { stream: createReadStream(path.join(signatureDirectory, safeName)), mime };
};

export const readInvoiceSignature = async (fileName: string) => {
  const safeName = path.basename(fileName);
  if (safeName !== fileName || !/^[0-9a-f-]+\.(?:jpg|png|webp)$/.test(safeName)) return null;
  const extension = path.extname(safeName).slice(1);
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const data = await readFile(path.join(signatureDirectory, safeName)).catch(() => null);
  return data ? { data, mime } : null;
};
