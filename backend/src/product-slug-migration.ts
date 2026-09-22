import type { Pool } from "pg";
import { productSlug } from "./seo.js";

export const backfillProductSlugs = async (pool: Pool) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE");
    const { rows } = await client.query<{ id: string; title_en: string; slug: string | null }>(
      "SELECT id,title_en,slug FROM products ORDER BY created_at ASC,id ASC"
    );
    const used = new Set(rows.flatMap((row) => row.slug ? [row.slug] : []));
    const reserved = new Set(rows.map((row) => row.slug || productSlug(row.title_en)));
    for (const row of rows) {
      if (row.slug) continue;
      const base = productSlug(row.title_en);
      let slug = base;
      // Preserve the existing title-derived URL; disambiguate only collisions.
      if (used.has(slug)) {
        slug = `${base}-${row.id}`;
        while (used.has(slug) || reserved.has(slug)) slug += "-2";
      }
      await client.query("UPDATE products SET slug=$1 WHERE id=$2", [slug, row.id]);
      used.add(slug);
    }
    await client.query("ALTER TABLE products ALTER COLUMN slug SET NOT NULL");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
