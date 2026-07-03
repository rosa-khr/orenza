import type { Pool, PoolClient } from "pg";
import { resourceConfigs, type ResourceConfig } from "./resource-config.js";

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

export class AdminRepository {
  constructor(private readonly pool: Pool) {}

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
    const select = resource === "products"
      ? "*, (sale_price_per_kg - purchase_price_per_kg) AS profit_per_kg"
      : "*";
    const orderBy = resource === "products" ? "sort_order ASC, created_at ASC" : "created_at DESC";
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
    const select = resource === "products"
      ? "*, (sale_price_per_kg - purchase_price_per_kg) AS profit_per_kg"
      : "*";
    const result = await this.pool.query<Record<string, unknown>>(`SELECT ${select} FROM ${config.table} WHERE id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
    const item = toPublicRecord(row);
    if (resource === "orders") {
      const orderItems = await this.pool.query<Record<string, unknown>>(
        "SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at",
        [id]
      );
      item.items = orderItems.rows.map(toPublicRecord);
    }
    return item;
  }

  async create(resource: string, input: unknown) {
    const config = configFor(resource);
    if (resource === "orders") throw Object.assign(new Error("سفارش از جریان خرید ثبت می‌شود."), { statusCode: 405 });
    const data = config.schema.parse(input);
    if (resource === "payment-methods" && (data as { isActive?: boolean }).isActive) {
      await this.pool.query(
        "UPDATE payment_methods SET is_active = false, updated_at = now() WHERE type = $1 AND is_active = true",
        [(data as { type: string }).type]
      );
    }
    const entries = normalizedValues(data, config);
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO ${config.table} (${columns.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
      values
    );
    return toPublicRecord(result.rows[0]!);
  }

  async update(resource: string, id: string, input: unknown) {
    const config = configFor(resource);
    const existing = await this.find(resource, id);
    const data = resource === "orders"
      ? config.schema.parse(input)
      : config.schema.parse({ ...existing, ...(input as Record<string, unknown>) });
    if (resource === "payment-methods" && (data as { isActive?: boolean }).isActive) {
      await this.pool.query(
        "UPDATE payment_methods SET is_active = false, updated_at = now() WHERE id <> $1 AND type = $2 AND is_active = true",
        [id, (data as { type: string }).type]
      );
    }
    const entries = normalizedValues(data, config, resource === "orders");
    if (!entries.length) return existing;
    const values = entries.map(([, value]) => value);
    const set = entries.map(([column], index) => `${column} = $${index + 1}`);
    values.push(id);
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE ${config.table} SET ${set.join(",")}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows[0]) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
    return toPublicRecord(result.rows[0]);
  }

  async remove(resource: string, id: string) {
    const config = configFor(resource);
    const result = resource === "orders"
      ? await this.pool.query(
          "DELETE FROM orders WHERE id = $1 AND order_status = 'new' AND payment_status = 'pending'",
          [id]
        )
      : await this.pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [id]);
    if (!result.rowCount) throw Object.assign(new Error("رکورد موردنظر پیدا نشد."), { statusCode: 404 });
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
