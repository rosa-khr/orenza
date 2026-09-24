import type { Pool, PoolClient } from "pg";
import { entityPublicPath, normalizeDestination, normalizeSitePath, upsertRedirect } from "../seo.js";
import { resourceConfigs, type ResourceConfig } from "./resource-config.js";

const allAdminPermissions = [
  "dashboard", "users", "roles", "products", "categories", "orders",
  "payment-methods", "shipping-methods", "discount-codes", "articles", "tags", "redirects", "site-settings", "logs", "content-generator", "accounting", "price-imports"
];

const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());

export const toPublicRecord = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value]));

const configFor = (resource: string) => {
  const config = resourceConfigs[resource];
  if (!config) throw Object.assign(new Error("بخش مدیریتی موردنظر وجود ندارد."), { statusCode: 404 });
  return config;
};

const normalizedValues = (data: Record<string, unknown>, config: ResourceConfig, partial = false) => {
  const parsed = partial ? data : config.schema.parse(data);
  const readonly = new Set(config.adminReadonly || []);
  return Object.entries(parsed)
    .filter(([key, value]) => config.columns[key] && !readonly.has(key) && value !== undefined)
    .map(([key, value]) => [config.columns[key]!, value instanceof Date ? value.toISOString() : value] as const);
};

const selectFor = (resource: string) => {
  if (resource === "users") {
    return `id,username,phone,email,display_name,first_name,last_name,role,
      admin_role_id,
      (SELECT title FROM admin_roles WHERE id=users.admin_role_id) AS panel_role_title,
      (password_hash IS NOT NULL) AS has_password,last_login_at,created_at,updated_at`;
  }
  if (resource === "roles") {
    return `admin_roles.*,
      ARRAY(SELECT permission_key FROM admin_role_permissions
            WHERE role_id=admin_roles.id ORDER BY permission_key) AS permissions`;
  }
  if (resource === "products") return `*,
    (sale_price_per_kg - purchase_price_per_kg) AS profit_per_kg,
    (deleted_at IS NOT NULL) AS is_deleted,
    CASE WHEN deleted_at IS NOT NULL THEN 'deleted' WHEN is_active THEN 'active' ELSE 'inactive' END AS record_status`;
  if (resource === "categories") return `*,
    (deleted_at IS NOT NULL) AS is_deleted,
    CASE WHEN deleted_at IS NOT NULL THEN 'deleted' WHEN is_active THEN 'active' ELSE 'inactive' END AS record_status`;
  return "*";
};

export class AdminRepository {
  constructor(private readonly pool: Pool) {}

  private async resolveRecordId(resource: string, identifier: string) {
    if (resource !== "products" || !/^\d+$/.test(identifier)) return identifier;
    const result = await this.pool.query<{ id: string }>(
      "SELECT id FROM products WHERE product_number=$1 LIMIT 1",
      [identifier]
    );
    if (!result.rows[0]) throw Object.assign(new Error("محصول موردنظر پیدا نشد."), { statusCode: 404 });
    return result.rows[0].id;
  }

  async list(resource: string, input: {
    page: number;
    pageSize: number;
    search?: string;
    orderStatus?: string;
    paymentStatus?: string;
    fromDate?: string;
    toDate?: string;
    paymentMethodId?: string;
  }) {
    const config = configFor(resource);
    const values: unknown[] = [];
    const where: string[] = [];
    if (input.search && config.search.length) {
      values.push(`%${input.search}%`);
      where.push(`(${config.search.map((column) => `${column} ILIKE $${values.length}`).join(" OR ")})`);
    }
    if (resource === "orders" && input.orderStatus) {
      values.push(input.orderStatus);
      where.push(`order_status = $${values.length}`);
    }
    if (resource === "orders" && input.paymentStatus) {
      values.push(input.paymentStatus);
      where.push(`payment_status = $${values.length}`);
    }
    if (input.fromDate) {
      values.push(input.fromDate);
      where.push(`created_at >= $${values.length}::date`);
    }
    if (input.toDate) {
      values.push(input.toDate);
      where.push(`created_at < ($${values.length}::date + interval '1 day')`);
    }
    if (resource === "payment-cards" && input.paymentMethodId) {
      values.push(input.paymentMethodId);
      where.push(`payment_method_id = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await this.pool.query<{ total: string }>(`SELECT count(*) AS total FROM ${config.table} ${whereSql}`, values);
    values.push(input.pageSize, (input.page - 1) * input.pageSize);
    const select = selectFor(resource);
    const orderBy = resource === "products" || resource === "categories"
      ? "sort_order ASC, created_at ASC"
      : "created_at DESC";
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT ${select} FROM ${config.table} ${whereSql} ORDER BY ${orderBy} LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    return {
      items: result.rows.map(toPublicRecord),
      total: Number(count.rows[0]?.total || 0),
      page: input.page,
      pageSize: input.pageSize
    };
  }

  async find(resource: string, id: string) {
    const config = configFor(resource);
    const select = selectFor(resource);
    const recordId = await this.resolveRecordId(resource, id);
    const result = await this.pool.query<Record<string, unknown>>(`SELECT ${select} FROM ${config.table} WHERE id = $1`, [recordId]);
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
    const item = toPublicRecord(row);
    if (resource === "orders") {
      const orderItems = await this.pool.query<Record<string, unknown>>(
        "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at",
        [recordId]
      );
      item.items = orderItems.rows.map(toPublicRecord);
    }
    if (resource === "products") {
      const [tags, relatedProducts] = await Promise.all([
        this.pool.query<{ tag_id: string }>(
          "SELECT tag_id FROM product_tags WHERE product_id=$1 ORDER BY created_at",
          [recordId]
        ),
        this.pool.query<{ related_product_id: string }>(
          "SELECT related_product_id FROM product_related_products WHERE product_id=$1 ORDER BY created_at",
          [recordId]
        )
      ]);
      item.tagIds = tags.rows.map((row) => row.tag_id);
      item.relatedProductIds = relatedProducts.rows.map((row) => row.related_product_id);
    }
    return item;
  }

  async create(resource: string, input: unknown) {
    const config = configFor(resource);
    if (resource === "orders") throw Object.assign(new Error("سفارش از جریان خرید ثبت می‌شود."), { statusCode: 405 });
    if (resource === "users") throw Object.assign(new Error("حساب کاربری از مسیر ثبت‌نام فروشگاه ایجاد می‌شود."), { statusCode: 405 });
    const data = config.schema.parse(input);
    if (resource === "redirects") {
      data.sourcePath = normalizeSitePath(String(data.sourcePath || ""));
      data.destination = normalizeDestination(String(data.destination || ""));
      const row = await withTransaction(this.pool, async (client) => {
        await upsertRedirect(client, {
          sourcePath: String(data.sourcePath),
          destination: String(data.destination),
          statusCode: data.statusCode as 301 | 302,
          entityType: (data.entityType as string | null | undefined) || null,
          entityId: (data.entityId as string | null | undefined) || null
        });
        const result = await client.query<Record<string, unknown>>(
          "SELECT * FROM redirects WHERE source_path=$1 AND is_active=true LIMIT 1",
          [data.sourcePath]
        );
        return result.rows[0]!;
      });
      return toPublicRecord(row);
    }
    if (resource === "payment-methods" && (data as { isActive?: boolean }).isActive) {
      await this.pool.query(
        "UPDATE payment_methods SET is_active = false, updated_at = now() WHERE type = $1 AND is_active = true",
        [(data as { type: string }).type]
      );
    }
    if (resource === "articles" && data.isPublished === true && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    if (resource === "categories") {
      await this.validateCategoryParent(null, (data as { parentCategoryId?: string | null }).parentCategoryId || null);
      return withTransaction(this.pool, async (client) => {
        // Keep simultaneous category creations in a deterministic sibling order.
        await client.query("LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE");
        const next = await client.query<{ sort_order: number }>(
          "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM categories WHERE parent_category_id IS NOT DISTINCT FROM $1::uuid",
          [data.parentCategoryId || null]
        );
        data.sortOrder = next.rows[0]!.sort_order;
        const entries = normalizedValues(data, config);
        const result = await client.query<Record<string, unknown>>(
          `INSERT INTO categories (${entries.map(([column]) => column).join(",")}) VALUES (${entries.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`,
          entries.map(([, value]) => value)
        );
        return toPublicRecord(result.rows[0]!);
      });
    }
    if (resource === "products") {
      const next = await this.pool.query<{ sort_order: number }>(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order FROM products WHERE deleted_at IS NULL"
      );
      data.sortOrder = next.rows[0]!.sort_order;
    }
    if (resource === "redirects") {
      data.sourcePath = normalizeSitePath(String(data.sourcePath || ""));
      data.destination = normalizeDestination(String(data.destination || ""));
      const client = await this.pool.connect();
      try {
        await upsertRedirect(client, {
          sourcePath: String(data.sourcePath),
          destination: String(data.destination),
          statusCode: data.statusCode as 301 | 302,
          entityType: (data.entityType as string | null | undefined) || null,
          entityId: (data.entityId as string | null | undefined) || null
        });
      } finally {
        client.release();
      }
      const row = await this.pool.query<Record<string, unknown>>("SELECT * FROM redirects WHERE source_path=$1 AND is_active=true", [data.sourcePath]);
      return toPublicRecord(row.rows[0]!);
    }
    const entries = normalizedValues(data, config, resource === "roles");
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO ${config.table} (${columns.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      values
    );
    if (resource === "roles") {
      await this.syncRolePermissions(
        String(result.rows[0]!.id),
        (data.permissions as string[]) || []
      );
    }
    if (resource === "products") {
      await this.syncProductRelations(
        String(result.rows[0]!.id),
        (data.tagIds as string[]) || [],
        (data.relatedProductIds as string[]) || []
      );
    }
    return toPublicRecord(result.rows[0]!);
  }

  async update(resource: string, id: string, input: unknown) {
    const config = configFor(resource);
    const existing = await this.find(resource, id);
    const recordId = String(existing.id || id);
    if ((resource === "products" || resource === "categories") && existing.isDeleted === true) {
      throw Object.assign(new Error("رکورد حذف‌شده قابل ویرایش نیست."), { statusCode: 409 });
    }
    const data = resource === "orders"
      ? config.schema.parse(input)
      : config.schema.parse({ ...existing, ...(input as Record<string, unknown>) });
    const oldPublicPath = entityPublicPath(resource, existing);
    if (
      resource === "orders" &&
      existing.orderStatus === "new" &&
      existing.paymentStatus === "pending" &&
      data.orderStatus === "processing"
    ) {
      // تأیید سفارش در پنل، تأیید پرداخت آن را هم شامل می‌شود؛ این قاعده
      // مستقل از کلاینت اعمال می‌شود تا سفارش در وضعیت pending باقی نماند.
      data.paymentStatus = "paid";
    }
    if (resource === "orders" && data.paymentStatus === "paid" && existing.paymentStatus !== "paid") {
      if (!existing.paymentRefId || !existing.paymentReceiptUrl) {
        throw Object.assign(new Error("بدون کد پیگیری و فیش واریزی، پرداخت قابل تأیید نیست."), { statusCode: 422 });
      }
      data.orderStatus = "processing";
    }
    if (resource === "users") {
      data.displayName = [data.firstName, data.lastName].filter(Boolean).join(" ");
    }
    if (["products", "categories", "tags", "articles"].includes(resource) && existing.robotsIndex === true) {
      data.robotsIndex = true;
    }
    if (resource === "articles" && data.isPublished === true && existing.isPublished !== true) {
      data.publishedAt = new Date();
    }
    if (resource === "roles" && existing.slug === "admin") {
      data.slug = "admin";
      data.isActive = true;
      data.permissions = allAdminPermissions;
    }
    if (resource === "payment-methods" && (data as { isActive?: boolean }).isActive) {
      await this.pool.query(
        "UPDATE payment_methods SET is_active = false, updated_at = now() WHERE id <> $1 AND type = $2 AND is_active = true",
        [recordId, (data as { type: string }).type]
      );
    }
    if (resource === "categories") {
      await this.validateCategoryParent(recordId, (data as { parentCategoryId?: string | null }).parentCategoryId || null);
    }
    if (resource === "redirects") {
      data.sourcePath = normalizeSitePath(String(data.sourcePath || ""));
      data.destination = normalizeDestination(String(data.destination || ""));
      const row = await withTransaction(this.pool, async (client) => {
        await client.query("UPDATE redirects SET is_active=false,updated_at=now() WHERE id=$1", [recordId]);
        await upsertRedirect(client, {
          sourcePath: String(data.sourcePath),
          destination: String(data.destination),
          statusCode: data.statusCode as 301 | 302,
          entityType: (data.entityType as string | null | undefined) || null,
          entityId: (data.entityId as string | null | undefined) || null
        });
        const result = await client.query<Record<string, unknown>>(
          "SELECT * FROM redirects WHERE source_path=$1 AND is_active=true LIMIT 1",
          [data.sourcePath]
        );
        return result.rows[0]!;
      });
      return toPublicRecord(row);
    }
    const entries = normalizedValues(
      data,
      config,
      resource === "orders" || resource === "users" || resource === "roles"
    );
    if (!entries.length) return existing;
    const values = entries.map(([, value]) => value);
    const set = entries.map(([column], index) => `${column} = $${index + 1}`);
    values.push(recordId);
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE ${config.table} SET ${set.join(",")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
    if (resource === "roles") {
      await this.syncRolePermissions(recordId, (data.permissions as string[]) || []);
    }
    if (resource === "products") {
      await this.syncProductRelations(
        recordId,
        (data.tagIds as string[]) || [],
        ((data.relatedProductIds as string[]) || []).filter((relatedId) => relatedId !== recordId)
      );
    }
    const newPublicPath = entityPublicPath(resource, data);
    if (oldPublicPath && newPublicPath && oldPublicPath !== newPublicPath) {
      const client = await this.pool.connect();
      try {
        await upsertRedirect(client, {
          sourcePath: oldPublicPath,
          destination: newPublicPath,
          statusCode: 301,
          entityType: resource,
          entityId: recordId
        });
      } finally {
        client.release();
      }
    }
    return toPublicRecord(result.rows[0]);
  }

  async remove(resource: string, id: string) {
    const config = configFor(resource);
    const recordId = await this.resolveRecordId(resource, id);
    if (resource === "users") {
      throw Object.assign(new Error("حذف حساب کاربری از پنل مجاز نیست."), { statusCode: 405 });
    }
    if (resource === "roles") {
      const role = await this.pool.query<{ is_system: boolean }>("SELECT is_system FROM admin_roles WHERE id=$1", [recordId]);
      if (role.rows[0]?.is_system) {
        throw Object.assign(new Error("نقش‌های سیستمی قابل حذف نیستند."), { statusCode: 422 });
      }
    }
    if (resource === "products" || resource === "categories") {
      const result = await this.pool.query(
        `UPDATE ${config.table}
            SET deleted_at=now(),is_active=false,updated_at=now()
          WHERE id=$1 AND deleted_at IS NULL`,
        [recordId]
      );
      if (!result.rowCount) throw Object.assign(new Error("رکورد موردنظر پیدا نشد یا قبلاً حذف شده است."), { statusCode: 404 });
      return;
    }
    const result = resource === "orders"
      ? await this.pool.query(
          "DELETE FROM orders WHERE id = $1 AND order_status = 'new' AND payment_status = 'pending'",
          [recordId]
        )
      : await this.pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [recordId]);
    if (!result.rowCount) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
  }

  private async syncRolePermissions(roleId: string, permissions: string[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM admin_role_permissions WHERE role_id=$1", [roleId]);
      for (const permission of permissions) {
        await client.query(
          "INSERT INTO admin_role_permissions (role_id,permission_key) VALUES ($1,$2)",
          [roleId, permission]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async syncProductRelations(productId: string, tagIds: string[], relatedProductIds: string[]) {
    const uniqueTagIds = [...new Set(tagIds)];
    const uniqueRelatedIds = [...new Set(relatedProductIds)].filter((id) => id !== productId);
    await withTransaction(this.pool, async (client) => {
      if (uniqueTagIds.length) {
        const tags = await client.query<{ id: string }>("SELECT id FROM tags WHERE id = ANY($1::uuid[])", [uniqueTagIds]);
        if (tags.rowCount !== uniqueTagIds.length) {
          throw Object.assign(new Error("یک یا چند برچسب انتخاب‌شده معتبر نیست."), { statusCode: 422 });
        }
      }
      if (uniqueRelatedIds.length) {
        const products = await client.query<{ id: string }>("SELECT id FROM products WHERE id = ANY($1::uuid[])", [uniqueRelatedIds]);
        if (products.rowCount !== uniqueRelatedIds.length) {
          throw Object.assign(new Error("یک یا چند محصول مرتبط معتبر نیست."), { statusCode: 422 });
        }
      }
      await client.query("DELETE FROM product_tags WHERE product_id=$1", [productId]);
      await client.query("DELETE FROM product_related_products WHERE product_id=$1", [productId]);
      if (uniqueTagIds.length) {
        await client.query(
          "INSERT INTO product_tags(product_id,tag_id) SELECT $1,unnest($2::uuid[])",
          [productId, uniqueTagIds]
        );
      }
      if (uniqueRelatedIds.length) {
        await client.query(
          "INSERT INTO product_related_products(product_id,related_product_id) SELECT $1,unnest($2::uuid[])",
          [productId, uniqueRelatedIds]
        );
      }
    });
  }

  private async validateCategoryParent(categoryId: string | null, parentCategoryId: string | null) {
    if (!parentCategoryId) return;
    if (categoryId && parentCategoryId === categoryId) {
      throw Object.assign(new Error("دسته‌بندی نمی‌تواند پدر خودش باشد."), { statusCode: 422 });
    }
    const parent = await this.pool.query<{ id: string }>("SELECT id FROM categories WHERE id=$1", [parentCategoryId]);
    if (!parent.rows[0]) {
      throw Object.assign(new Error("دسته‌بندی پدر انتخاب‌شده پیدا نشد."), { statusCode: 422 });
    }
    if (!categoryId) return;
    const descendant = await this.pool.query<{ id: string }>(
      `WITH RECURSIVE descendants AS (
        SELECT id FROM categories WHERE parent_category_id = $1
        UNION ALL
        SELECT c.id
        FROM categories c
        JOIN descendants d ON c.parent_category_id = d.id
      )
      SELECT id FROM descendants WHERE id = $2 LIMIT 1`,
      [categoryId, parentCategoryId]
    );
    if (descendant.rows[0]) {
      throw Object.assign(new Error("زیرمجموعه همین دسته‌بندی نمی‌تواند به عنوان پدر انتخاب شود."), { statusCode: 422 });
    }
  }
}

export const withTransaction = async <T>(pool: Pool, handler: (client: PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
