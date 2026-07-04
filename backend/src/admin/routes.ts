import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { hashPassword, hashSessionToken, verifyPassword } from "../security.js";
import { getSiteSettings, updateSiteSettings } from "../site-settings.js";
import { AdminRepository } from "./repository.js";

type AdminUser = { id: string; role: "customer" | "admin"; admin_role_id: string | null };

const allPermissions = [
  "dashboard", "users", "roles", "products", "categories", "orders",
  "payment-methods", "discount-codes", "articles", "tags", "site-settings"
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

  app.get("/api/v1/admin/assignable-roles", async (request, reply) => {
    if (!(await requirePermission(request, reply, "users"))) return;
    const roles = await pool.query<{ id: string; title: string; slug: string }>(
      "SELECT id,title,slug FROM admin_roles WHERE is_active=true ORDER BY is_system DESC,title"
    );
    return { roles: roles.rows };
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
    }>(`SELECT
      (SELECT count(*) FROM orders WHERE order_status = 'new') AS new_orders,
      (SELECT count(*) FROM orders WHERE order_status IN ('new','processing')) AS pending_shipment,
      (SELECT count(*) FROM orders WHERE order_status = 'sent') AS sent_orders,
      (SELECT count(*) FROM users WHERE role = 'customer') AS customers,
      (SELECT count(*) FROM products WHERE is_active = true) AS active_products,
      (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE visited_on >= current_date - 29) AS visitors`);
    const row = result.rows[0]!;
    return {
      stats: {
        newOrders: Number(row.new_orders),
        pendingShipment: Number(row.pending_shipment),
        sentOrders: Number(row.sent_orders),
        customers: Number(row.customers),
        activeProducts: Number(row.active_products),
        visitors: Number(row.visitors)
      }
    };
  });

  app.get("/api/v1/admin/site-settings", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    return { item: await getSiteSettings(pool) };
  });

  app.put("/api/v1/admin/site-settings", async (request, reply) => {
    if (!(await requirePermission(request, reply, "site-settings"))) return;
    return { item: await updateSiteSettings(pool, request.body) };
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
