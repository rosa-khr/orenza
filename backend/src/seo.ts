import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

export const productSlug = (titleEn: string) =>
  titleEn
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "orenza-product";

export const categoryHref = (slug: string) => {
  if (slug === "products") return "/products/";
  if (slug === "wholesale") return "/wholesale/";
  if (slug === "order") return "/order/";
  if (slug === "about-orenza") return "/about/";
  return `/products/${encodeURIComponent(slug)}/`;
};

export const normalizeSitePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? new URL(trimmed)
    : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, "https://orenza.ir");
  if (parsed.hash) throw Object.assign(new Error("آدرس نباید شامل fragment باشد."), { statusCode: 422 });
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
  const pathname = parsed.pathname.endsWith("/") || parsed.pathname.includes(".")
    ? parsed.pathname
    : `${parsed.pathname}/`;
  return `${pathname}${parsed.search}`;
};

export const normalizeDestination = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const parsed = new URL(trimmed);
    if (parsed.hash) throw Object.assign(new Error("آدرس مقصد نباید شامل fragment باشد."), { statusCode: 422 });
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (!parsed.pathname.endsWith("/") && !parsed.pathname.includes(".")) parsed.pathname += "/";
    parsed.hash = "";
    return parsed.toString();
  }
  return normalizeSitePath(trimmed);
};

export const entityPublicPath = (resource: string, data: Record<string, unknown>) => {
  if (resource === "products") return `/products/${encodeURIComponent(productSlug(String(data.titleEn || data.title_en || "")))}/`;
  if (resource === "categories") return categoryHref(String(data.slug || ""));
  if (resource === "tags") return `/tags/${encodeURIComponent(String(data.slug || ""))}/`;
  if (resource === "articles") return `/articles/${encodeURIComponent(String(data.slug || ""))}/`;
  return null;
};

const finalDestinationFor = async (client: PoolClient, path: string) => {
  let current = normalizeSitePath(path);
  const seen = new Set<string>();
  for (let depth = 0; depth < 12; depth += 1) {
    if (seen.has(current)) {
      throw Object.assign(new Error("Redirect loop شناسایی شد."), { statusCode: 422 });
    }
    seen.add(current);
    const result = await client.query<{ destination: string }>(
      "SELECT destination FROM redirects WHERE source_path=$1 AND is_active=true LIMIT 1",
      [current]
    );
    const destination = result.rows[0]?.destination;
    if (!destination || destination.startsWith("http://") || destination.startsWith("https://")) return destination || current;
    current = normalizeSitePath(destination);
  }
  throw Object.assign(new Error("زنجیره ریدایرکت بیش از حد طولانی است."), { statusCode: 422 });
};

export const upsertRedirect = async (
  client: PoolClient,
  input: {
    sourcePath: string;
    destination: string;
    statusCode?: 301 | 302;
    entityType?: string | null;
    entityId?: string | null;
    createdBy?: string | null;
  }
) => {
  const sourcePath = normalizeSitePath(input.sourcePath);
  const destination = normalizeDestination(input.destination);
  if (!sourcePath || !destination) return;
  const comparableDestination = destination.startsWith("http://") || destination.startsWith("https://")
    ? normalizeSitePath(new URL(destination).pathname + new URL(destination).search)
    : normalizeSitePath(destination);
  if (sourcePath === comparableDestination) {
    throw Object.assign(new Error("ریدایرکت به همان آدرس مجاز نیست."), { statusCode: 422 });
  }
  const finalDestination = destination.startsWith("http://") || destination.startsWith("https://")
    ? destination
    : await finalDestinationFor(client, destination);
  const finalComparable = finalDestination.startsWith("http://") || finalDestination.startsWith("https://")
    ? normalizeSitePath(new URL(finalDestination).pathname + new URL(finalDestination).search)
    : normalizeSitePath(finalDestination);
  if (sourcePath === finalComparable) {
    throw Object.assign(new Error("این ریدایرکت باعث loop می‌شود."), { statusCode: 422 });
  }
  await client.query(
    `UPDATE redirects
        SET destination=$1,status_code=$2,is_active=true,entity_type=COALESCE($3,entity_type),
            entity_id=COALESCE($4,entity_id),updated_at=now()
      WHERE is_active=true AND destination=$5`,
    [finalDestination, input.statusCode || 301, input.entityType || null, input.entityId || null, sourcePath]
  );
  await client.query(
    `INSERT INTO redirects (source_path,destination,status_code,is_active,entity_type,entity_id,created_by)
     VALUES ($1,$2,$3,true,$4,$5,$6)
     ON CONFLICT (source_path) WHERE is_active
     DO UPDATE SET destination=EXCLUDED.destination,status_code=EXCLUDED.status_code,
       entity_type=EXCLUDED.entity_type,entity_id=EXCLUDED.entity_id,updated_at=now()`,
    [sourcePath, finalDestination, input.statusCode || 301, input.entityType || null, input.entityId || null, input.createdBy || null]
  );
};

export const registerRedirects = (app: FastifyInstance, pool: Pool) => {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== "GET" && request.method !== "HEAD") return;
    const rawPath = request.url.split("?")[0] || "/";
    if (rawPath.startsWith("/api/") || rawPath.startsWith("/admin/") || rawPath.startsWith("/_assets/")) return;
    let sourcePath = "";
    try {
      sourcePath = normalizeSitePath(rawPath);
    } catch {
      return;
    }
    const result = await pool.query<{ destination: string; status_code: number }>(
      "SELECT destination,status_code FROM redirects WHERE source_path=$1 AND is_active=true LIMIT 1",
      [sourcePath]
    );
    const redirect = result.rows[0];
    if (!redirect) return;
    reply.code(redirect.status_code).header("Location", redirect.destination).send();
  });
};
