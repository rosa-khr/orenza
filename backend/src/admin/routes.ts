import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { hashPassword, hashSessionToken, verifyPassword } from "../security.js";
import { getContentAiSettings, getSiteSettings, updateSiteSettings } from "../site-settings.js";
import { AdminRepository } from "./repository.js";
import { openPaymentReceipt } from "../payment-receipts.js";
import {
  openInvoiceSignature,
  removeInvoiceSignature,
  saveInvoiceSignature
} from "../invoice-signatures.js";
import { saveProductImage } from "../product-images.js";
import { removeHomepageBanner, saveHomepageBanner } from "../homepage-banners.js";
import { persistLog } from "../logger.js";
import * as XLSX from "xlsx";

type AdminUser = { id: string; role: "customer" | "admin"; admin_role_id: string | null };

const normalizeOpenAiKey = (value: string | undefined) =>
  value?.trim().replace(/^Bearer\s+/i, "").replace(/^['\"]|['\"]$/g, "") || "";

const allPermissions = [
  "dashboard", "users", "roles", "products", "categories", "orders",
  "payment-methods", "discount-codes", "articles", "tags", "site-settings", "logs", "content-generator", "accounting", "price-imports"
] as const;

export const registerAdminRoutes = (
  app: FastifyInstance,
  pool: Pool,
  getCurrentUser: (request: FastifyRequest) => Promise<AdminUser | null>
) => {
  const repository = new AdminRepository(pool);
  const permissionsFor = async (user: AdminUser) => {
    if (user.role !== "admin" || !user.admin_role_id) return [] as string[];
    const role = await pool.query<{ slug: string; is_active: boolean }>(
      "SELECT slug,is_active FROM admin_roles WHERE id=$1",
      [user.admin_role_id]
    );
    if (!role.rows[0]?.is_active) return [] as string[];
    if (role.rows[0].slug === "admin") return [...allPermissions];
    const permissions = await pool.query<{ permission_key: string }>(
      "SELECT permission_key FROM admin_role_permissions WHERE role_id=$1",
      [user.admin_role_id]
    );
    return permissions.rows.map((item) => item.permission_key);
  };
  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await getCurrentUser(request);
    if (!user) {
      await reply.code(401).send({ error: "برای ادامه، وارد حساب مدیریت شوید." });
      return null;
    }
    if (user.role !== "admin") {
      await reply.code(403).send({ error: "این حساب دسترسی مدیریت ندارد." });
      return null;
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.origin;
      const host = request.headers["x-forwarded-host"] || request.headers.host;
      if (origin && (!host || new URL(origin).host !== host)) {
        await reply.code(403).send({ error: "درخواست مدیریت از مبدأ نامعتبر رد شد." });
        return null;
      }
    }
    return user;
  };
  const requirePermission = async (
    request: FastifyRequest,
    reply: FastifyReply,
    permission: string
  ) => {
    const user = await requireAdmin(request, reply);
    if (!user) return null;
    const permissions = await permissionsFor(user);
    if (!permissions.includes(permission)) {
      await reply.code(403).send({ error: "نقش شما به این بخش دسترسی ندارد." });
      return null;
    }
    return { user, permissions };
  };
  const permissionForResource = (resource: string) =>
    resource === "payment-cards"
      ? "payment-methods"
      : resource === "service-scripts"
        ? "site-settings"
        : resource;

  app.get("/api/v1/admin/access", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const role = admin.admin_role_id
      ? await pool.query<{ id: string; title: string; slug: string }>(
          "SELECT id,title,slug FROM admin_roles WHERE id=$1 AND is_active=true",
          [admin.admin_role_id]
        )
      : null;
    return {
      role: role?.rows[0] || null,
      permissions: await permissionsFor(admin)
    };
  });

  app.get("/api/v1/admin/logs", async (request, reply) => {
    if (!(await requirePermission(request, reply, "logs"))) return;
    const filters = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(30),
      level: z.enum(["info", "warn", "error"]).optional(),
      search: z.string().trim().max(160).optional(),
      event: z.string().trim().max(100).optional(),
      message: z.string().trim().max(500).optional(),
      method: z.string().trim().max(10).optional(),
      route: z.string().trim().max(300).optional(),
      requestId: z.string().trim().max(100).optional(),
      statusCode: z.coerce.number().int().min(100).max(599).optional(),
      minDuration: z.coerce.number().int().min(0).optional(),
      maxDuration: z.coerce.number().int().min(0).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional()
    }).parse(request.query);
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (filters.level) {
      values.push(filters.level);
      conditions.push(`level = $${values.length}`);
    }
    if (filters.search) {
      values.push(`%${filters.search}%`);
      conditions.push(`(event ILIKE $${values.length} OR message ILIKE $${values.length} OR route ILIKE $${values.length})`);
    }
    for (const [field, value] of [["event", filters.event], ["method", filters.method], ["route", filters.route]] as const) {
      if (value) { values.push(`%${value}%`); conditions.push(`${field} ILIKE $${values.length}`); }
    }
    if (filters.message) { values.push(`%${filters.message}%`); conditions.push(`message ILIKE $${values.length}`); }
    if (filters.requestId) { values.push(`%${filters.requestId}%`); conditions.push(`request_id ILIKE $${values.length}`); }
    if (filters.statusCode) { values.push(filters.statusCode); conditions.push(`status_code = $${values.length}`); }
    if (filters.minDuration != null) { values.push(filters.minDuration); conditions.push(`duration_ms >= $${values.length}`); }
    if (filters.maxDuration != null) { values.push(filters.maxDuration); conditions.push(`duration_ms <= $${values.length}`); }
    if (filters.from) { values.push(filters.from); conditions.push(`created_at >= $${values.length}::date`); }
    if (filters.to) { values.push(filters.to); conditions.push(`created_at < ($${values.length}::date + interval '1 day')`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await pool.query<{ count: string }>(`SELECT count(*) FROM application_logs ${where}`, values);
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await pool.query(`SELECT id,level,event,message,request_id,method,route,status_code,duration_ms,metadata,created_at
      FROM application_logs ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.pageSize, offset]);
    return { items: rows.rows, page: filters.page, pageSize: filters.pageSize, total: Number(count.rows[0]?.count || 0) };
  });

  app.get("/api/v1/admin/logs/:id", async (request, reply) => {
    if (!(await requirePermission(request, reply, "logs"))) return;
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    const result = await pool.query("SELECT * FROM application_logs WHERE id=$1", [id]);
    if (!result.rows[0]) return reply.code(404).send({ error: "لاگ پیدا نشد." });
    return { item: result.rows[0] };
  });

  app.get("/api/v1/admin/assignable-roles", async (request, reply) => {
    if (!(await requirePermission(request, reply, "users"))) return;
    const roles = await pool.query<{ id: string; title: string; slug: string }>(
      "SELECT id,title,slug FROM admin_roles WHERE is_active=true ORDER BY is_system DESC,title"
    );
    return { roles: roles.rows };
  });

  const normalizeImportText = (value: unknown) => String(value ?? "")
    .trim()
    .toLocaleLowerCase("fa-IR")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\s+/g, " ");
  const parseImportPrice = (value: unknown) => {
    const normalized = String(value ?? "")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٬,\/\s تومان]/g, "");
    if (!/^\d+$/.test(normalized)) return null;
    const price = Number(normalized);
    return Number.isSafeInteger(price) && price >= 0 && price <= 10_000_000_000 ? price : null;
  };
  const parseIncreaseValue = (value: unknown) => {
    const normalized = String(value ?? "")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٬,\/\s تومان]/g, "")
      .replace(/٫/g, ".");
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000_000 ? amount : null;
  };
  const parseIncreaseType = (value: unknown) => {
    const normalized = normalizeImportText(value).replace(/[‌]/g, " ");
    if (["percent", "percentage", "درصد", "درصدی", "سود درصدی"].includes(normalized)) return "percent" as const;
    if (["fixed", "amount", "مبلغ", "مبلغ ثابت", "ثابت"].includes(normalized)) return "fixed" as const;
    return null;
  };

  app.get("/api/v1/admin/price-imports/sample", async (request, reply) => {
    if (!(await requirePermission(request, reply, "price-imports"))) return;
    const products = await pool.query<{ id: string; title_fa: string; purchase_price_per_kg: number }>(
      "SELECT id,title_fa,purchase_price_per_kg FROM products ORDER BY sort_order ASC, title_fa ASC"
    );
    const sheet = XLSX.utils.aoa_to_sheet([
      ["product_id", "product", "purchase_price_per_kg_toman", "increase_type", "increase_value"],
      ...products.rows.map((product) => [product.id, product.title_fa, Number(product.purchase_price_per_kg), "", ""])
    ]);
    sheet["!cols"] = [{ wch: 38 }, { wch: 28 }, { wch: 25 }, { wch: 18 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "قیمت خرید");
    const file = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return reply
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="orenza-price-accounting-sample.xlsx"')
      .send(file);
  });

  app.get("/api/v1/admin/price-imports", async (request, reply) => {
    if (!(await requirePermission(request, reply, "price-imports"))) return;
    const result = await pool.query(`
      SELECT j.id,j.file_name,j.status,j.total_rows,j.updated_rows,j.failed_rows,j.error_message,
             j.started_at,j.completed_at,u.display_name
      FROM price_import_jobs j
      LEFT JOIN users u ON u.id=j.created_by
      ORDER BY j.started_at DESC LIMIT 100`);
    return { items: result.rows };
  });

  app.get("/api/v1/admin/price-imports/:id", async (request, reply) => {
    if (!(await requirePermission(request, reply, "price-imports"))) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const [job, items] = await Promise.all([
      pool.query(`SELECT id,file_name,status,total_rows,updated_rows,failed_rows,error_message,
                         file_mime_type,file_size,created_by,started_at,completed_at
                  FROM price_import_jobs WHERE id=$1`, [id]),
      pool.query("SELECT * FROM price_import_items WHERE job_id=$1 ORDER BY row_number", [id])
    ]);
    if (!job.rows[0]) return reply.code(404).send({ error: "اجرای موردنظر پیدا نشد." });
    return { item: job.rows[0], rows: items.rows };
  });

  app.get("/api/v1/admin/price-imports/:id/file", async (request, reply) => {
    if (!(await requirePermission(request, reply, "price-imports"))) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await pool.query<{ file_name: string; file_mime_type: string | null; file_content: Buffer | null }>(
      "SELECT file_name,file_mime_type,file_content FROM price_import_jobs WHERE id=$1",
      [id]
    );
    const storedFile = result.rows[0];
    if (!storedFile?.file_content) return reply.code(404).send({ error: "فایل این اجرای قدیمی در سیستم ذخیره نشده است." });
    const encodedName = encodeURIComponent(storedFile.file_name).replace(/'/g, "%27");
    return reply
      .type(storedFile.file_mime_type || "application/octet-stream")
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodedName}`)
      .send(storedFile.file_content);
  });

  app.post("/api/v1/admin/price-imports", async (request, reply) => {
    const access = await requirePermission(request, reply, "price-imports");
    if (!access) return;
    const file = await request.file();
    if (!file) return reply.code(422).send({ error: "فایل Excel یا CSV را انتخاب کنید." });
    if (!/\.(xlsx|xls|csv)$/i.test(file.filename)) return reply.code(422).send({ error: "فرمت فایل باید Excel یا CSV باشد." });
    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) return reply.code(413).send({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد." });

    let rows: unknown[][];
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
      if (!firstSheet) throw new Error();
      rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true, defval: "" });
    } catch {
      return reply.code(422).send({ error: "خواندن فایل Excel انجام نشد." });
    }
    const headers = (rows[0] || []).map(normalizeImportText);
    const productIdIndex = headers.findIndex((header) => ["product_id", "شناسه محصول", "id"].includes(header));
    const productIndex = headers.findIndex((header) => ["product", "محصول", "نام محصول", "عنوان محصول"].includes(header));
    const priceIndex = headers.findIndex((header) => ["purchase_price_per_kg", "purchase_price_per_kg_toman", "purchase price per kg", "قیمت خرید", "قیمت خرید هر کیلو", "قیمت"].includes(header));
    const increaseTypeIndex = headers.findIndex((header) => ["increase_type", "increase mode", "نوع افزایش", "نوع سود"].includes(header));
    const increaseValueIndex = headers.findIndex((header) => ["increase_value", "increase amount", "markup_percent", "fixed_increase_toman", "درصد سود", "مبلغ افزایش", "مقدار افزایش"].includes(header));
    if ((productIdIndex < 0 && productIndex < 0) || priceIndex < 0) {
      return reply.code(422).send({ error: "سرستون‌های فایل باید product یا product_id و قیمت خرید را داشته باشند. فایل نمونه را دانلود کنید." });
    }
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
    if (!dataRows.length) return reply.code(422).send({ error: "فایل هیچ ردیف قیمتی ندارد." });
    if (dataRows.length > 1000) return reply.code(422).send({ error: "هر فایل حداکثر می‌تواند ۱۰۰۰ محصول داشته باشد." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const job = await client.query<{ id: string }>(
        `INSERT INTO price_import_jobs(file_name,status,total_rows,created_by,file_content,file_mime_type,file_size)
         VALUES($1,'processing',$2,$3,$4,$5,$6) RETURNING id`,
        [file.filename, dataRows.length, access.user.id, buffer, file.mimetype || "application/octet-stream", buffer.length]
      );
      const jobId = job.rows[0]!.id;
      const updates: { rowNumber: number; identifier: string; productId: string; productTitle: string; previous: number; next: number; previousSale: number; sale: number; increaseType: "percent" | "fixed" | null; increaseValue: number | null }[] = [];
      const failures: { rowNumber: number; identifier: string; error: string }[] = [];
      for (let index = 0; index < dataRows.length; index += 1) {
        const row = dataRows[index]!;
        const identifier = String((productIdIndex >= 0 ? row[productIdIndex] : "") || (productIndex >= 0 ? row[productIndex] : "") || "").trim();
        const price = parseImportPrice(row[priceIndex]);
        const increaseType = increaseTypeIndex >= 0 ? parseIncreaseType(row[increaseTypeIndex]) : null;
        const increaseValue = increaseValueIndex >= 0 ? parseIncreaseValue(row[increaseValueIndex]) : null;
        if (!identifier) { failures.push({ rowNumber: index + 2, identifier: "", error: "محصول مشخص نشده است." }); continue; }
        if (price == null) { failures.push({ rowNumber: index + 2, identifier, error: "قیمت خرید باید یک عدد صحیح معتبر باشد." }); continue; }
        const product = await client.query<{ id: string; purchase_price_per_kg: number; sale_price_per_kg: number; title_fa: string }>(
          `SELECT id,purchase_price_per_kg,sale_price_per_kg,title_fa FROM products
           WHERE id::text=$1 OR lower(title_fa)=lower($1) OR lower(title_en)=lower($1) LIMIT 2`, [identifier]
        );
        if (product.rows.length !== 1) {
          failures.push({ rowNumber: index + 2, identifier, error: product.rows.length ? "این نام محصول تکراری است." : "محصول پیدا نشد." });
          continue;
        }
        const hasIncrease = increaseType !== null || increaseValue !== null;
        const safeIncreaseType = increaseType || "fixed";
        const safeIncreaseValue = increaseValue || 0;
        if (hasIncrease && safeIncreaseType === "percent" && safeIncreaseValue > 1000) { failures.push({ rowNumber: index + 2, identifier, error: "مقدار درصد افزایش معتبر نیست." }); continue; }
        const sale = hasIncrease
          ? (safeIncreaseType === "percent" ? Math.round(price * (1 + safeIncreaseValue / 100)) : Math.round(price + safeIncreaseValue))
          : Number(product.rows[0]!.sale_price_per_kg);
        if (!Number.isSafeInteger(sale) || sale > 10_000_000_000) { failures.push({ rowNumber: index + 2, identifier, error: "قیمت فروش نهایی معتبر نیست." }); continue; }
        updates.push({
          rowNumber: index + 2,
          identifier,
          productId: product.rows[0]!.id,
          productTitle: product.rows[0]!.title_fa,
          previous: Number(product.rows[0]!.purchase_price_per_kg),
          next: price,
          previousSale: Number(product.rows[0]!.sale_price_per_kg),
          sale,
          increaseType: hasIncrease ? safeIncreaseType : null,
          increaseValue: hasIncrease ? safeIncreaseValue : null
        });
      }
      for (const item of failures) {
        await client.query(`INSERT INTO price_import_items(job_id,row_number,product_identifier,status,error_message) VALUES($1,$2,$3,'failed',$4)`, [jobId, item.rowNumber, item.identifier, item.error]);
      }
      for (const item of updates) {
        await client.query("UPDATE products SET purchase_price_per_kg=$1,sale_price_per_kg=$2,updated_at=now() WHERE id=$3", [item.next, item.sale, item.productId]);
        await client.query(
          `INSERT INTO price_import_items(
             job_id,row_number,product_identifier,product_id,product_title,previous_purchase_price,new_purchase_price,
             previous_sale_price,new_sale_price,increase_type,increase_value,status
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'updated')`,
          [jobId, item.rowNumber, item.identifier, item.productId, item.productTitle, item.previous, item.next, item.previousSale, item.sale, item.increaseType, item.increaseValue]
        );
      }
      const jobStatus = updates.length ? "completed" : "failed";
      const errorMessage = failures.length ? `${failures.length} ردیف رد شد؛ سایر ردیف‌های معتبر اجرا شدند.` : null;
      await client.query(`UPDATE price_import_jobs SET status=$2,updated_rows=$3,failed_rows=$4,error_message=$5,completed_at=now() WHERE id=$1`, [jobId, jobStatus, updates.length, failures.length, errorMessage]);
      await client.query("COMMIT");
      if (!updates.length) return reply.code(422).send({ error: "هیچ ردیف معتبری برای به‌روزرسانی پیدا نشد.", jobId, failedRows: failures.length });
      return { jobId, status: "completed", updatedRows: updates.length, failedRows: failures.length };
    } catch (error) {
      await client.query("ROLLBACK");
      request.log.error({ event: "price_import_failed", err: error }, "Price import failed");
      return reply.code(500).send({ error: "اجرای به‌روزرسانی قیمت انجام نشد." });
    } finally { client.release(); }
  });

  const contentTemplateSchema = z.object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(400).default(""),
    contentType: z.string().trim().min(2).max(80),
    audience: z.string().trim().max(200).default(""),
    tone: z.string().trim().max(100).default(""),
    language: z.enum(["fa", "en"]).default("fa"),
    length: z.enum(["short", "medium", "long"]).default("medium"),
    extraInstructions: z.string().trim().max(5000).default("")
  });
  const contentTemplateSelect = `
    SELECT id,title,description,content_type AS "contentType",audience,tone,language,
           content_length AS length,extra_instructions AS "extraInstructions",
           is_system AS "isSystem",updated_at AS "updatedAt"
      FROM content_templates`;

  app.get("/api/v1/admin/content-templates", async (request, reply) => {
    if (!(await requirePermission(request, reply, "content-generator"))) return;
    const result = await pool.query(`${contentTemplateSelect} ORDER BY is_system DESC,updated_at DESC,title`);
    return { items: result.rows };
  });

  app.get("/api/v1/admin/content-templates/:id", async (request, reply) => {
    if (!(await requirePermission(request, reply, "content-generator"))) return;
    const id = z.string().uuid().parse((request.params as { id?: string }).id);
    const result = await pool.query(`${contentTemplateSelect} WHERE id=$1`, [id]);
    if (!result.rows[0]) return reply.code(404).send({ error: "قالب محتوا پیدا نشد." });
    return { item: result.rows[0] };
  });

  app.post("/api/v1/admin/content-templates", async (request, reply) => {
    const admin = await requirePermission(request, reply, "content-generator");
    if (!admin) return;
    const data = contentTemplateSchema.parse(request.body);
    const result = await pool.query(
      `INSERT INTO content_templates(title,description,content_type,audience,tone,language,content_length,extra_instructions,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [data.title, data.description, data.contentType, data.audience, data.tone, data.language, data.length, data.extraInstructions, admin.user.id]
    );
    const saved = await pool.query(`${contentTemplateSelect} WHERE id=$1`, [result.rows[0].id]);
    return reply.code(201).send({ item: saved.rows[0] });
  });

  app.patch("/api/v1/admin/content-templates/:id", async (request, reply) => {
    if (!(await requirePermission(request, reply, "content-generator"))) return;
    const id = z.string().uuid().parse((request.params as { id?: string }).id);
    const data = contentTemplateSchema.parse(request.body);
    const result = await pool.query(
      `UPDATE content_templates
          SET title=$2,description=$3,content_type=$4,audience=$5,tone=$6,language=$7,
              content_length=$8,extra_instructions=$9,updated_at=now()
        WHERE id=$1 RETURNING id`,
      [id, data.title, data.description, data.contentType, data.audience, data.tone, data.language, data.length, data.extraInstructions]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "قالب محتوا پیدا نشد." });
    const saved = await pool.query(`${contentTemplateSelect} WHERE id=$1`, [id]);
    return { item: saved.rows[0] };
  });

  app.delete("/api/v1/admin/content-templates/:id", async (request, reply) => {
    if (!(await requirePermission(request, reply, "content-generator"))) return;
    const id = z.string().uuid().parse((request.params as { id?: string }).id);
    const result = await pool.query("DELETE FROM content_templates WHERE id=$1 AND is_system=false RETURNING id", [id]);
    if (!result.rowCount) return reply.code(409).send({ error: "قالب‌های پیش‌فرض قابل حذف نیستند؛ می‌توانید آن‌ها را ویرایش کنید." });
    return reply.code(204).send();
  });

  app.post("/api/v1/admin/content-generator", async (request, reply) => {
    const admin = await requirePermission(request, reply, "content-generator");
    if (!admin) return;
    const data = z.object({
      contentType: z.string().trim().min(2).max(80),
      topic: z.string().trim().min(3).max(300),
      keywords: z.string().trim().max(5000).default(""),
      audience: z.string().trim().max(200).default(""),
      tone: z.string().trim().max(100).default(""),
      language: z.enum(["fa", "en"]).optional(),
      length: z.enum(["short", "medium", "long"]).optional(),
      extraInstructions: z.string().trim().max(5000).default("")
    }).parse(request.body);
    const ai = await getContentAiSettings(pool);
    const apiKey = normalizeOpenAiKey(ai.apiKey || process.env.OPENAI_API_KEY);
    if (!apiKey) return reply.code(503).send({ error: "کلید سرویس تولید محتوا در تنظیمات سایت ثبت نشده است." });
    const length = data.length || ai.defaultLength;
    const language = data.language || ai.defaultLanguage;
    const lengthLabel = { short: "کوتاه، حدود ۱۵۰ کلمه", medium: "متوسط، حدود ۳۵۰ کلمه", long: "کامل، حدود ۷۰۰ کلمه" }[length];
    const languageLabel = language === "fa" ? "فارسی روان و طبیعی" : "English";
    const audience = data.audience || ai.defaultAudience;
    const tone = data.tone || ai.defaultTone;
    const instructions = `تو نویسنده و استراتژیست محتوای برند قهوه اورنزا هستی. خروجی باید ${languageLabel}، دقیق، کاربردی و آماده انتشار باشد.
${ai.instructions}
نوع محتوا: ${data.contentType}. طول: ${lengthLabel}.
خروجی را فقط به‌صورت HTML تمیز و بدون Markdown یا code fence برگردان. فقط از تگ‌های p، h2، h3، strong، em، ul، ol، li، blockquote، a و table استفاده کن.`;
    const prompt = `قالب تولید محتوا:
موضوع اصلی: ${data.topic}
کلمات کلیدی: ${data.keywords || "بدون کلمه کلیدی مشخص"}
مخاطب هدف: ${audience}
لحن: ${tone}
دستورهای تکمیلی: ${data.extraInstructions || "ندارد"}

بر اساس این قالب، محتوای نهایی را تولید کن.`;
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: ai.model, instructions, input: prompt, store: false }),
        signal: AbortSignal.timeout(90_000)
      });
    } catch (error) {
      request.log.error({ event: "content_generation_request_failed", err: error }, "Content generation request failed");
      return reply.code(502).send({ error: "ارتباط با سرویس هوش مصنوعی برقرار نشد؛ اتصال سرور و کلید API را بررسی کنید." });
    }
    const payload = await response.json() as { output_text?: string; output?: { content?: { text?: string }[] }[]; error?: { message?: string } };
    if (!response.ok) {
      request.log.error({ event: "content_generation_failed", statusCode: response.status, providerMessage: payload.error?.message }, "Content generation failed");
      const providerMessage = payload.error?.message?.trim();
      return reply.code(502).send({ error: providerMessage ? `تولید محتوا ناموفق بود: ${providerMessage}` : "تولید محتوا از سرویس هوش مصنوعی ناموفق بود." });
    }
    const content = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n").trim();
    if (!content) return reply.code(502).send({ error: "سرویس هوش مصنوعی خروجی متنی برنگرداند." });
    return { content, model: ai.model };
  });

  app.post("/api/v1/admin/content-keywords", async (request, reply) => {
    if (!(await requirePermission(request, reply, "content-generator"))) return;
    const ai = await getContentAiSettings(pool);
    const apiKey = normalizeOpenAiKey(ai.apiKey || process.env.OPENAI_API_KEY);
    const file = await request.file();
    if (!file) return reply.code(422).send({ error: "فایل Excel یا تصویر کلمات کلیدی را انتخاب کنید." });
    const buffer = await file.toBuffer();
    if (buffer.length > 5 * 1024 * 1024) return reply.code(413).send({ error: "حجم فایل نباید بیشتر از ۵ مگابایت باشد." });
    const fileName = file.filename.toLowerCase();
    const isExcel = /\.(xlsx|xls|csv)$/.test(fileName);
    if (isExcel) {
      try {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!firstSheet) return reply.code(422).send({ error: "در فایل Excel شیتی برای خواندن پیدا نشد." });
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: true, defval: "" });
        const keywords = rows.slice(0, 500).map((row) => row.map(String).map((value) => value.trim()).filter(Boolean).join(" | ")).filter(Boolean).join("\n");
        if (!keywords) return reply.code(422).send({ error: "در فایل Excel کلمه‌ای پیدا نشد." });
        return { keywords, source: "excel" };
      } catch {
        return reply.code(422).send({ error: "خواندن فایل Excel انجام نشد." });
      }
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype) || !apiKey) {
      return reply.code(422).send({ error: apiKey ? "فرمت فایل باید Excel، CSV یا تصویر JPG/PNG/WebP باشد." : "برای تحلیل تصویر، کلید سرویس تولید محتوا باید تنظیم شده باشد." });
    }
    const imageUrl = `data:${file.mimetype};base64,${buffer.toString("base64")}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: ai.model, store: false, input: [{ role: "user", content: [
        { type: "input_text", text: "این تصویر خروجی ابزار تحقیق کلمات کلیدی است. همه کلمات قابل خواندن را استخراج کن و برای هرکدام اگر وزن، اندازه، رنگ یا عددی نشان داده شده، همان را کنار کلمه بنویس. فقط فهرست خط‌به‌خط کلمات را برگردان و هیچ توضیح دیگری نده." },
        { type: "input_image", image_url: imageUrl, detail: "high" }
      ] }] })
    });
    const payload = await response.json() as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    if (!response.ok) return reply.code(502).send({ error: "تحلیل تصویر کلمات کلیدی ناموفق بود." });
    const keywords = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n").trim();
    if (!keywords) return reply.code(422).send({ error: "کلمه‌ای از تصویر قابل استخراج نبود." });
    return { keywords, source: "image" };
  });

  app.get("/api/v1/admin/profile", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const result = await pool.query<{
      id: string;
      username: string | null;
      phone: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
      role: "admin";
      panel_role_title: string | null;
    }>(
      `SELECT u.id,u.username,u.phone,u.email,u.first_name,u.last_name,u.display_name,u.role,
        r.title AS panel_role_title
       FROM users u LEFT JOIN admin_roles r ON r.id=u.admin_role_id WHERE u.id = $1`,
      [admin.id]
    );
    const user = result.rows[0]!;
    return {
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
        panelRoleTitle: user.panel_role_title
      }
    };
  });

  app.patch("/api/v1/admin/profile", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const data = z.object({
      firstName: z.string().trim().min(2).max(100),
      lastName: z.string().trim().min(2).max(100)
    }).parse(request.body);
    const displayName = `${data.firstName} ${data.lastName}`;
    const result = await pool.query<{
      first_name: string;
      last_name: string;
      display_name: string;
      role: "admin";
    }>(
      `UPDATE users SET first_name=$1,last_name=$2,display_name=$3,updated_at=now()
       WHERE id=$4 RETURNING first_name,last_name,display_name,role`,
      [data.firstName, data.lastName, displayName, admin.id]
    );
    const user = result.rows[0]!;
    return {
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role
      }
    };
  });

  app.post("/api/v1/admin/profile/change-password", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;
    const data = z.object({
      currentPassword: z.string().min(8).max(128),
      newPassword: z.string().min(8).max(128)
    }).parse(request.body);
    const current = await pool.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [admin.id]
    );
    const passwordHash = current.rows[0]?.password_hash;
    if (!passwordHash || !(await verifyPassword(data.currentPassword, passwordHash))) {
      return reply.code(422).send({ error: "رمز عبور فعلی صحیح نیست." });
    }
    await pool.query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2", [
      await hashPassword(data.newPassword),
      admin.id
    ]);
    const currentTokenHash = hashSessionToken(request.cookies.orenza_session || "");
    await pool.query("DELETE FROM user_sessions WHERE user_id=$1 AND token_hash<>$2", [admin.id, currentTokenHash]);
    return { message: "رمز عبور مدیریت تغییر کرد." };
  });

  app.post("/api/v1/admin/users/:id/reset-password", async (request, reply) => {
    if (!(await requirePermission(request, reply, "users"))) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { newPassword } = z.object({
      newPassword: z.string().min(8).max(128)
    }).parse(request.body);
    const result = await pool.query<{ id: string }>(
      "UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2 RETURNING id",
      [await hashPassword(newPassword), id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "کاربر موردنظر پیدا نشد." });
    await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [id]);
    return { message: "رمز عبور کاربر تغییر کرد و نشست‌های قبلی او بسته شد." };
  });

  app.post("/api/v1/admin/users/:id/assign-role", async (request, reply) => {
    const access = await requirePermission(request, reply, "users");
    if (!access) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { roleId } = z.object({ roleId: z.string().uuid().nullable() }).parse(request.body);
    if (id === access.user.id && roleId !== access.user.admin_role_id) {
      return reply.code(422).send({ error: "نمی‌توانید نقش حساب فعلی خود را تغییر دهید." });
    }
    if (roleId) {
      const role = await pool.query<{ id: string }>(
        "SELECT id FROM admin_roles WHERE id=$1 AND is_active=true",
        [roleId]
      );
      if (!role.rows[0]) return reply.code(422).send({ error: "نقش انتخاب‌شده فعال نیست." });
    }
    const result = await pool.query<{ id: string }>(
      `UPDATE users SET role=$1,admin_role_id=$2,updated_at=now() WHERE id=$3 RETURNING id`,
      [roleId ? "admin" : "customer", roleId, id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "کاربر موردنظر پیدا نشد." });
    if (id !== access.user.id) {
      await pool.query("DELETE FROM user_sessions WHERE user_id=$1", [id]);
    }
    return { message: roleId ? "نقش پنل برای کاربر ثبت شد." : "دسترسی پنل کاربر برداشته شد." };
  });

  app.get("/api/v1/admin/dashboard", async (request, reply) => {
    if (!(await requirePermission(request, reply, "dashboard"))) return;
    const result = await pool.query<{
      new_orders: string;
      pending_shipment: string;
      sent_orders: string;
      customers: string;
      active_products: string;
      visitors: string;
      processing_orders: string;
      ready_orders: string;
      completed_orders: string;
      canceled_orders: string;
      total_sales: string;
      total_profit: string;
    }>(`SELECT
      (SELECT count(*) FROM orders WHERE order_status = 'new') AS new_orders,
      (SELECT count(*) FROM orders WHERE order_status IN ('new','processing','ready')) AS pending_shipment,
      (SELECT count(*) FROM orders WHERE order_status = 'sent') AS sent_orders,
      (SELECT count(*) FROM orders WHERE order_status = 'processing') AS processing_orders,
      (SELECT count(*) FROM orders WHERE order_status = 'ready') AS ready_orders,
      (SELECT count(*) FROM orders WHERE order_status = 'completed') AS completed_orders,
      (SELECT count(*) FROM orders WHERE order_status = 'canceled') AS canceled_orders,
      (SELECT count(*) FROM users WHERE role = 'customer') AS customers,
      (SELECT count(*) FROM products WHERE is_active = true) AS active_products,
      (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE visited_on >= current_date - 29) AS visitors,
      (SELECT COALESCE(sum(final_amount),0) FROM orders WHERE payment_status='paid' AND order_status<>'canceled') AS total_sales,
      (SELECT COALESCE(sum((o.total_amount-o.discount_amount)-COALESCE(costs.total_cost,0)),0)
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT sum(COALESCE(oi.total_cost,
             CASE WHEN p.sale_type='packaged'
               THEN p.purchase_price_per_kg*oi.quantity
               ELSE round(p.purchase_price_per_kg*oi.weight/1000.0)*oi.quantity END
           )) AS total_cost
           FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id
         ) costs ON true
         WHERE o.payment_status='paid' AND o.order_status<>'canceled') AS total_profit`);
    const row = result.rows[0]!;
    return {
      stats: {
        newOrders: Number(row.new_orders),
        pendingShipment: Number(row.pending_shipment),
        sentOrders: Number(row.sent_orders),
        customers: Number(row.customers),
        activeProducts: Number(row.active_products),
        visitors: Number(row.visitors),
        totalSales: Number(row.total_sales),
        totalProfit: Number(row.total_profit)
      },
      orderStatuses: {
        new: Number(row.new_orders),
        processing: Number(row.processing_orders),
        ready: Number(row.ready_orders),
        sent: Number(row.sent_orders),
        completed: Number(row.completed_orders),
        canceled: Number(row.canceled_orders)
      }
    };
  });

  app.get("/api/v1/admin/site-settings", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    const [item, ai] = await Promise.all([getSiteSettings(pool), getContentAiSettings(pool)]);
    return { item: { ...item, contentAiModel: ai.model, contentAiApiKey: "", contentAiKeyConfigured: Boolean(ai.apiKey), contentAiInstructions: ai.instructions, contentAiDefaultAudience: ai.defaultAudience, contentAiDefaultTone: ai.defaultTone, contentAiDefaultLength: ai.defaultLength, contentAiDefaultLanguage: ai.defaultLanguage } };
  });

  app.put("/api/v1/admin/site-settings", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    return { item: await updateSiteSettings(pool, request.body) };
  });

  app.post("/api/v1/admin/site-settings/homepage-banner/:kind", {
    bodyLimit: 6 * 1024 * 1024
  }, async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    const { kind } = z.object({ kind: z.enum(["desktop", "mobile"]) }).parse(request.params);
    const part = await request.file();
    if (!part || part.fieldname !== "banner") {
      return reply.code(422).send({ error: "تصویر بنر را انتخاب کنید." });
    }
    const saved = await saveHomepageBanner(await part.toBuffer(), kind);
    const column = kind === "desktop" ? "homepage_banner_desktop_url" : "homepage_banner_mobile_url";
    try {
      const previous = await pool.query<Record<string, string | null>>(
        `SELECT ${column} FROM site_settings WHERE id=1`
      );
      await pool.query(
        `UPDATE site_settings SET ${column}=$1,updated_at=now() WHERE id=1`,
        [saved.url]
      );
      const oldFileName = previous.rows[0]?.[column]?.split("/").pop();
      if (oldFileName) await removeHomepageBanner(oldFileName);
      return { url: saved.url };
    } catch (error) {
      await removeHomepageBanner(saved.fileName);
      throw error;
    }
  });

  app.delete("/api/v1/admin/site-settings/homepage-banner/:kind", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    const { kind } = z.object({ kind: z.enum(["desktop", "mobile"]) }).parse(request.params);
    const column = kind === "desktop" ? "homepage_banner_desktop_url" : "homepage_banner_mobile_url";
    const previous = await pool.query<Record<string, string | null>>(
      `SELECT ${column} FROM site_settings WHERE id=1`
    );
    await pool.query(`UPDATE site_settings SET ${column}=NULL,updated_at=now() WHERE id=1`);
    const oldFileName = previous.rows[0]?.[column]?.split("/").pop();
    if (oldFileName) await removeHomepageBanner(oldFileName);
    return { success: true };
  });

  app.get("/api/v1/admin/invoice-settings", async (request, reply) => {
    if (!(await requirePermission(request, reply, "orders"))) return;
    const settings = await getSiteSettings(pool);
    return {
      item: {
        brandName: settings.brandName,
        brandNameEn: settings.brandNameEn,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        instagramUrl: settings.instagramUrl,
        websiteUrl: settings.websiteUrl,
        address: settings.address,
        invoiceNationalId: settings.invoiceNationalId,
        invoiceSignatureUrl: settings.invoiceSignatureUrl
      }
    };
  });

  app.post("/api/v1/admin/site-settings/invoice-signature", {
    bodyLimit: 6 * 1024 * 1024
  }, async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    const part = await request.file();
    if (!part || part.fieldname !== "signature") {
      return reply.code(422).send({ error: "تصویر امضای فروشنده را انتخاب کنید." });
    }
    const saved = await saveInvoiceSignature(await part.toBuffer());
    try {
      const previous = await pool.query<{ invoice_signature_url: string | null }>(
        "SELECT invoice_signature_url FROM site_settings WHERE id=1"
      );
      await pool.query(
        "UPDATE site_settings SET invoice_signature_url=$1,updated_at=now() WHERE id=1",
        [saved.url]
      );
      const oldFileName = previous.rows[0]?.invoice_signature_url?.split("/").pop();
      if (oldFileName) await removeInvoiceSignature(oldFileName);
      return { url: saved.url };
    } catch (error) {
      await removeInvoiceSignature(saved.fileName);
      throw error;
    }
  });

  app.delete("/api/v1/admin/site-settings/invoice-signature", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    const previous = await pool.query<{ invoice_signature_url: string | null }>(
      "SELECT invoice_signature_url FROM site_settings WHERE id=1"
    );
    await pool.query(
      "UPDATE site_settings SET invoice_signature_url=NULL,updated_at=now() WHERE id=1"
    );
    const oldFileName = previous.rows[0]?.invoice_signature_url?.split("/").pop();
    if (oldFileName) await removeInvoiceSignature(oldFileName);
    return { success: true };
  });

  app.get("/api/v1/admin/invoice-signatures/:fileName", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { fileName } = z.object({
      fileName: z.string().regex(/^[0-9a-f-]+\.(?:jpg|png|webp)$/)
    }).parse(request.params);
    const signature = openInvoiceSignature(fileName);
    if (!signature) return reply.code(404).send({ error: "تصویر امضا پیدا نشد." });
    reply.type(signature.mime).header("Cache-Control", "private, max-age=300");
    return reply.send(signature.stream);
  });

  app.post("/api/v1/admin/product-images", {
    bodyLimit: 6 * 1024 * 1024
  }, async (request, reply) => {
    if (!(await requirePermission(request, reply, "products"))) return;
    const part = await request.file();
    if (!part || part.fieldname !== "image") {
      return reply.code(422).send({ error: "تصویر محصول را انتخاب کنید." });
    }
    return saveProductImage(await part.toBuffer());
  });

  app.post("/api/v1/admin/content-images", {
    bodyLimit: 6 * 1024 * 1024
  }, async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const part = await request.file();
    if (!part || part.fieldname !== "image") return reply.code(422).send({ error: "تصویر محتوا را انتخاب کنید." });
    return saveProductImage(await part.toBuffer());
  });

  app.post("/api/v1/admin/category-images", {
    bodyLimit: 6 * 1024 * 1024
  }, async (request, reply) => {
    if (!(await requirePermission(request, reply, "categories"))) return;
    const part = await request.file();
    if (!part || part.fieldname !== "image") {
      return reply.code(422).send({ error: "بنر دسته‌بندی را انتخاب کنید." });
    }
    return saveProductImage(await part.toBuffer());
  });

  app.get("/api/v1/admin/payment-receipts/:fileName", async (request, reply) => {
    if (!(await requirePermission(request, reply, "orders"))) return;
    const { fileName } = z.object({
      fileName: z.string().regex(/^[0-9a-f-]+\.(?:jpg|png|webp)$/)
    }).parse(request.params);
    const receipt = openPaymentReceipt(fileName);
    if (!receipt) return reply.code(404).send({ error: "فیش پیدا نشد." });
    reply.type(receipt.mime).header("Cache-Control", "private, max-age=300");
    return reply.send(receipt.stream);
  });

  app.post("/api/v1/admin/orders/:id/payment-decision", async (request, reply) => {
    if (!(await requirePermission(request, reply, "orders"))) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = z.object({
      decision: z.enum(["approve", "reject"]),
      adminNote: z.string().trim().max(3000).nullable().optional()
    }).parse(request.body);
    const result = await pool.query<Record<string, unknown>>(
      `UPDATE orders
          SET payment_status = $2::varchar,
              order_status = CASE WHEN $2::varchar = 'paid' THEN 'processing' ELSE order_status END,
              admin_note = COALESCE($3, admin_note),
              updated_at = now()
        WHERE id = $1
          AND payment_status = 'pending'
          AND payment_ref_id IS NOT NULL
          AND payment_receipt_url IS NOT NULL
      RETURNING *`,
      [id, data.decision === "approve" ? "paid" : "rejected", data.adminNote ?? null]
    );
    if (!result.rows[0]) {
      return reply.code(422).send({ error: "سفارش پیدا نشد، قبلاً بررسی شده یا مدارک پرداخت کامل نیست." });
    }
    return { item: result.rows[0] };
  });

  app.post("/api/v1/admin/orders/:id/fulfillment-transition", async (request, reply) => {
    if (!(await requirePermission(request, reply, "orders"))) return;
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { action } = z.object({
      action: z.enum(["ready", "sent"])
    }).parse(request.body);
    const expectedStatus = action === "ready" ? "processing" : "ready";
    const result = await pool.query<Record<string, unknown>>(
      `UPDATE orders
          SET order_status=$2,updated_at=now()
        WHERE id=$1
          AND order_status=$3
      RETURNING *`,
      [id, action, expectedStatus]
    );
    if (!result.rows[0]) {
      const required = action === "ready"
        ? "سفارش باید در حال آماده‌سازی باشد."
        : "ابتدا باید وضعیت آماده ارسال سفارش ثبت شود.";
      return reply.code(422).send({ error: required });
    }
    return { item: result.rows[0] };
  });

  app.get("/api/v1/admin/:resource", async (request, reply) => {
    const { resource } = z.object({ resource: z.string().min(1) }).parse(request.params);
    if (!(await requirePermission(request, reply, permissionForResource(resource)))) return;
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(15),
      search: z.string().trim().max(200).optional(),
      orderStatus: z.string().optional(),
      paymentStatus: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      paymentMethodId: z.string().uuid().optional()
    }).parse(request.query);
    return repository.list(resource, query);
  });

  app.get("/api/v1/admin/:resource/:id", async (request, reply) => {
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    if (!(await requirePermission(request, reply, permissionForResource(resource)))) return;
    return { item: await repository.find(resource, id) };
  });

  app.post("/api/v1/admin/:resource", async (request, reply) => {
    const { resource } = z.object({ resource: z.string() }).parse(request.params);
    if (!(await requirePermission(request, reply, permissionForResource(resource)))) return;
    return reply.code(201).send({ item: await repository.create(resource, request.body) });
  });

  app.put("/api/v1/admin/:resource/:id", async (request, reply) => {
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    const access = await requirePermission(request, reply, permissionForResource(resource));
    if (!access) return;
    return { item: await repository.update(resource, id, request.body) };
  });

  app.delete("/api/v1/admin/:resource/:id", async (request, reply) => {
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    if (!(await requirePermission(request, reply, permissionForResource(resource)))) return;
    await repository.remove(resource, id);
    return reply.code(204).send();
  });
};
