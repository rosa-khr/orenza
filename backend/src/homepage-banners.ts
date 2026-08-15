import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const homepageImageDirectory =
  process.env.PUBLIC_IMAGES_DIR || path.resolve(process.cwd(), "../public/images");

const formats = [
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    mime: "image/png",
    extension: "png",
    matches: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (buffer: Buffer) => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP"
  }
];

export type HomepageBannerKind = "desktop" | "mobile";

export const saveHomepageBanner = async (buffer: Buffer, kind: HomepageBannerKind) => {
  const format = formats.find((item) => item.matches(buffer));
  if (!format) {
    throw Object.assign(new Error("بنر باید تصویر JPG، PNG یا WebP معتبر باشد."), { statusCode: 422 });
  }
  await mkdir(homepageImageDirectory, { recursive: true });
  const fileName = `homepage-banner-${kind}-${crypto.randomUUID()}.${format.extension}`;
  await writeFile(path.join(homepageImageDirectory, fileName), buffer, { flag: "wx", mode: 0o644 });
  return { fileName, url: `/api/v1/homepage-banners/${fileName}` };
};

export const removeHomepageBanner = async (fileName: string) => {
  await unlink(path.join(homepageImageDirectory, path.basename(fileName))).catch(() => undefined);
};

export const openHomepageBanner = (fileName: string) => {
  const safeName = path.basename(fileName);
  if (safeName !== fileName || !/^homepage-banner-(?:desktop|mobile)-[0-9a-f-]+\.(?:jpg|png|webp)$/.test(safeName)) return null;
  const extension = path.extname(safeName).slice(1);
  return {
    stream: createReadStream(path.join(homepageImageDirectory, safeName)),
    mime: extension === "jpg" ? "image/jpeg" : `image/${extension}`
  };
};
