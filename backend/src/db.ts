import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000
});

export const query = <T extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
  pool.query<T>(text, values);
