import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { pool, query } from "./db.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizePhone,
  verifyPassword
} from "./security.js";
import { sendPasswordResetCode } from "./sms.js";

type UserRow = {
  id: string;
  phone: string | null;
  email: string | null;
  password_hash: string | null;
  display_name: string | null;
  role: "customer" | "admin";
  created_at: Date;
};

type AddressRow = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  province: string;
  city: string;
  postal_code: string;
  address_line: string;
  is_default: boolean;
};

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 32_000 });
const cookieName = "orenza_session";
const sessionDays = 30;
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const passwordResetSecret = process.env.PASSWORD_RESET_SECRET || "orenza-local-reset-secret";
const allowedOrigins = (process.env.APP_ORIGIN || "http://127.0.0.1:4321,http://localhost:4321")
  .split(",")
  .map((origin) => origin.trim());

await app.register(cookie);
await app.register(cors, {
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  credentials: true
});
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

const publicUser = (user: UserRow) => ({
  id: user.id,
  phone: user.phone,
  email: user.email,
  displayName: user.display_name,
  role: user.role,
  hasPassword: Boolean(user.password_hash),
  createdAt: user.created_at
});

const setSession = async (reply: FastifyReply, userId: string) => {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  await query(
    "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [tokenHash, userId, String(sessionDays)]
  );
  reply.setCookie(cookieName, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: sessionDays * 24 * 60 * 60
  });
};

const currentUser = async (request: FastifyRequest): Promise<UserRow | null> => {
  const token = request.cookies[cookieName];
  if (!token) return null;
  const result = await query<UserRow>(
    `SELECT u.*
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSessionToken(token)]
  );
  return result.rows[0] ?? null;
};

const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await currentUser(request);
  if (!user) {
    await reply.code(401).send({ error: "برای ادامه، وارد حساب کاربری خود شوید." });
    return null;
  }
  return user;
};

const phoneSchema = z.string().transform(normalizePhone).pipe(z.string().regex(/^09\d{9}$/));
const passwordSchema = z.string().min(8).max(128);
const hashResetCode = (phone: string, code: string) =>
  createHash("sha256").update(`${phone}:${code}:${passwordResetSecret}`).digest("hex");
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: phoneSchema.optional()
});
const addressSchema = z.object({
  label: z.string().trim().min(2).max(40),
  recipientName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  province: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().transform((value) => normalizePhone(value)).pipe(z.string().regex(/^\d{10}$/)),
  addressLine: z.string().trim().min(10).max(500),
  isDefault: z.boolean().default(false)
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.code(422).send({ error: "لطفاً اطلاعات واردشده را بررسی کنید.", fields: error.flatten() });
  }
  if ((error as { code?: string }).code === "23505") {
    return reply.code(409).send({ error: "این شماره موبایل یا ایمیل قبلاً ثبت شده است." });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "در حال حاضر امکان انجام درخواست وجود ندارد. لطفاً دوباره تلاش کنید." });
});

app.get("/health", async () => {
  await query("SELECT 1");
  return { status: "ok", database: "connected" };
});

app.post("/api/v1/auth/register", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const data = z.object({
    phone: phoneSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(100)
  }).parse(request.body);
  const passwordHash = await hashPassword(data.password);
  const result = await query<UserRow>(
    `INSERT INTO users (phone, password_hash, display_name, last_login_at)
     VALUES ($1, $2, $3, now()) RETURNING *`,
    [data.phone, passwordHash, data.displayName]
  );
  const user = result.rows[0]!;
  await setSession(reply, user.id);
  return reply.code(201).send({ user: publicUser(user) });
});

app.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const data = z.object({ phone: phoneSchema, password: passwordSchema }).parse(request.body);
  const result = await query<UserRow>("SELECT * FROM users WHERE phone = $1", [data.phone]);
  const user = result.rows[0];
  if (!user?.password_hash || !(await verifyPassword(data.password, user.password_hash))) {
    return reply.code(401).send({ error: "شماره موبایل یا رمز عبور صحیح نیست." });
  }
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await setSession(reply, user.id);
  return { user: publicUser(user) };
});

app.post("/api/v1/auth/password-reset/request", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const { phone } = z.object({ phone: phoneSchema }).parse(request.body);
  const result = await query<UserRow>("SELECT * FROM users WHERE phone = $1", [phone]);
  const user = result.rows[0];
  const genericMessage = "اگر این شماره در اورنزا ثبت شده باشد، کد بازیابی برای آن ارسال می‌شود.";
  if (!user) return { message: genericMessage };

  const code = String(randomInt(100_000, 1_000_000));
  await query("UPDATE password_reset_codes SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [user.id]);
  await query(
    `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
     VALUES ($1, $2, now() + interval '10 minutes')`,
    [user.id, hashResetCode(phone, code)]
  );

  try {
    const delivery = await sendPasswordResetCode(phone, code);
    return { message: genericMessage, ...delivery };
  } catch (error) {
    app.log.error(error);
    return reply.code(503).send({ error: "ارسال کد بازیابی فعلاً ممکن نیست. لطفاً کمی بعد دوباره تلاش کنید." });
  }
});

app.post("/api/v1/auth/password-reset/confirm", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const data = z.object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/),
    newPassword: passwordSchema
  }).parse(request.body);
  const result = await query<{ id: string; user_id: string; code_hash: string; attempts: number }>(
    `SELECT r.id, r.user_id, r.code_hash, r.attempts
       FROM password_reset_codes r
       JOIN users u ON u.id = r.user_id
      WHERE u.phone = $1 AND r.used_at IS NULL AND r.expires_at > now()
      ORDER BY r.created_at DESC LIMIT 1`,
    [data.phone]
  );
  const reset = result.rows[0];
  const expected = reset ? Buffer.from(reset.code_hash, "hex") : Buffer.alloc(32);
  const actual = Buffer.from(hashResetCode(data.phone, data.code), "hex");
  const isValid = Boolean(reset && reset.attempts < 5 && expected.length === actual.length && timingSafeEqual(expected, actual));
  if (!isValid) {
    if (reset) await query("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1", [reset.id]);
    return reply.code(422).send({ error: "کد بازیابی صحیح نیست یا زمان آن گذشته است." });
  }

  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    await hashPassword(data.newPassword),
    reset!.user_id
  ]);
  await query("UPDATE password_reset_codes SET used_at = now() WHERE id = $1", [reset!.id]);
  await query("DELETE FROM user_sessions WHERE user_id = $1", [reset!.user_id]);
  return { message: "رمز عبور تازه ثبت شد؛ حالا می‌توانید وارد حساب شوید." };
});

app.post("/api/v1/auth/google", { config: { rateLimit: { max: 15, timeWindow: "15 minutes" } } }, async (request, reply) => {
  if (!googleClient) return reply.code(503).send({ error: "ورود گوگل هنوز پیکربندی نشده است." });
  const { credential } = z.object({ credential: z.string().min(20) }).parse(request.body);
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    return reply.code(401).send({ error: "حساب گوگل قابل تأیید نیست." });
  }
  const result = await query<UserRow>(
    `INSERT INTO users (email, display_name, google_subject, last_login_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (google_subject) DO UPDATE
       SET email = EXCLUDED.email, display_name = COALESCE(users.display_name, EXCLUDED.display_name), last_login_at = now()
     RETURNING *`,
    [payload.email.toLowerCase(), payload.name || payload.email.split("@")[0], payload.sub]
  );
  const user = result.rows[0]!;
  await setSession(reply, user.id);
  return { user: publicUser(user) };
});

app.post("/api/v1/auth/logout", async (request, reply) => {
  const token = request.cookies[cookieName];
  if (token) await query("DELETE FROM user_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  reply.clearCookie(cookieName, { path: "/" });
  return reply.code(204).send();
});

app.get("/api/v1/me", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  return { user: publicUser(user) };
});

app.patch("/api/v1/me", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const data = profileSchema.parse(request.body);
  const result = await query<UserRow>(
    "UPDATE users SET display_name = $1, phone = COALESCE($2, phone), updated_at = now() WHERE id = $3 RETURNING *",
    [data.displayName, data.phone ?? null, user.id]
  );
  return { user: publicUser(result.rows[0]!) };
});

app.post("/api/v1/me/change-password", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const data = z.object({
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordSchema
  }).parse(request.body);
  if (user.password_hash && (!data.currentPassword || !(await verifyPassword(data.currentPassword, user.password_hash)))) {
    return reply.code(422).send({ error: "رمز عبور فعلی صحیح نیست." });
  }
  await query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    await hashPassword(data.newPassword),
    user.id
  ]);
  await query("DELETE FROM user_sessions WHERE user_id = $1 AND token_hash <> $2", [
    user.id,
    hashSessionToken(request.cookies[cookieName] || "")
  ]);
  return { message: "رمز عبور با موفقیت تغییر کرد." };
});

app.get("/api/v1/me/addresses", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const result = await query<AddressRow>(
    "SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [user.id]
  );
  return { addresses: result.rows };
});

app.post("/api/v1/me/addresses", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const data = addressSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const count = await client.query<{ count: string }>("SELECT count(*) FROM user_addresses WHERE user_id = $1", [user.id]);
    const makeDefault = data.isDefault || Number(count.rows[0]?.count || 0) === 0;
    if (makeDefault) await client.query("UPDATE user_addresses SET is_default = false WHERE user_id = $1", [user.id]);
    const result = await client.query<AddressRow>(
      `INSERT INTO user_addresses
       (user_id, label, recipient_name, phone, province, city, postal_code, address_line, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [user.id, data.label, data.recipientName, data.phone, data.province, data.city, data.postalCode, data.addressLine, makeDefault]
    );
    await client.query("COMMIT");
    return reply.code(201).send({ address: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.put("/api/v1/me/addresses/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const data = addressSchema.parse(request.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (data.isDefault) await client.query("UPDATE user_addresses SET is_default = false WHERE user_id = $1", [user.id]);
    const result = await client.query<AddressRow>(
      `UPDATE user_addresses SET label=$1, recipient_name=$2, phone=$3, province=$4, city=$5,
       postal_code=$6, address_line=$7, is_default=$8, updated_at=now()
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [data.label, data.recipientName, data.phone, data.province, data.city, data.postalCode, data.addressLine, data.isDefault, id, user.id]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: "نشانی موردنظر پیدا نشد." });
    await client.query("COMMIT");
    return { address: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/v1/me/addresses/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const result = await query<{ is_default: boolean }>(
    "DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default",
    [id, user.id]
  );
  if (!result.rows[0]) return reply.code(404).send({ error: "نشانی موردنظر پیدا نشد." });
  if (result.rows[0].is_default) {
    await query(
      `UPDATE user_addresses SET is_default = true
       WHERE id = (SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [user.id]
    );
  }
  return reply.code(204).send();
});

const port = Number(process.env.PORT || 8787);
await app.listen({ host: "0.0.0.0", port });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
