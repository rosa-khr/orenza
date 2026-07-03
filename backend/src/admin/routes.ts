import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { AdminRepository } from "./repository.js";

type AdminUser = { id: string; role: "customer" | "admin" };

export const registerAdminRoutes = (
  app: FastifyInstance,
  pool: Pool,
  getCurrentUser: (request: FastifyRequest) => Promise<AdminUser | null>
) => {
  const repository = new AdminRepository(pool);
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

  app.get("/api/v1/admin/dashboard", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
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

  app.get("/api/v1/admin/:resource", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { resource } = z.object({ resource: z.string().min(1) }).parse(request.params);
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
    if (!(await requireAdmin(request, reply))) return;
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    return { item: await repository.find(resource, id) };
  });

  app.post("/api/v1/admin/:resource", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { resource } = z.object({ resource: z.string() }).parse(request.params);
    return reply.code(201).send({ item: await repository.create(resource, request.body) });
  });

  app.put("/api/v1/admin/:resource/:id", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    return { item: await repository.update(resource, id, request.body) };
  });

  app.delete("/api/v1/admin/:resource/:id", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { resource, id } = z.object({ resource: z.string(), id: z.string().uuid() }).parse(request.params);
    await repository.remove(resource, id);
    return reply.code(204).send();
  });
};
