import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { pool } from "./db.js";

const requestIdPattern = /^[\w-]{8,100}$/;

export const createRequestId = (request: IncomingMessage) => {
  const supplied = request.headers["x-request-id"];
  const requestId = Array.isArray(supplied) ? supplied[0] : supplied;
  return requestId && requestIdPattern.test(requestId) ? requestId : randomUUID();
};

export const loggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "req.headers['x-api-key']",
      "password",
      "currentPassword",
      "newPassword",
      "code",
      "credential",
      "token",
      "tokenHash",
      "codeHash"
    ],
    censor: "[REDACTED]"
  },
  serializers: {
    req: (request: FastifyRequest) => ({
      method: request.method,
      url: request.url,
      requestId: request.id
    })
  }
};

export type PersistedLog = {
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export const persistLog = (log: PersistedLog) => {
  void pool.query(
    `INSERT INTO application_logs
      (level,event,message,request_id,method,route,status_code,duration_ms,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      log.level, log.event, log.message, log.requestId || null, log.method || null,
      log.route || null, log.statusCode ?? null, log.durationMs ?? null,
      JSON.stringify(log.metadata || {})
    ]
  ).catch(() => undefined);
};

export const ensureLogsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_logs (
      id bigserial PRIMARY KEY,
      level varchar(10) NOT NULL CHECK (level IN ('info','warn','error')),
      event varchar(100) NOT NULL,
      message varchar(500) NOT NULL,
      request_id varchar(100), method varchar(10), route varchar(300),
      status_code smallint, duration_ms integer,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS application_logs_created_at_idx ON application_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS application_logs_level_idx ON application_logs(level);
  `);
};

export const registerRequestLogging = (app: FastifyInstance<any, any, any, any, any>) => {
  const requestStartedAt = new WeakMap<object, number>();
  app.addHook("onRequest", async (request) => {
    requestStartedAt.set(request, Date.now());
  });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStartedAt.get(request) || Date.now();
    const log = {
      event: "http_request",
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      durationMs: Math.max(0, Date.now() - startedAt)
    };
    request.log.info(log, "HTTP request completed");
    persistLog({ level: reply.statusCode >= 500 ? "error" : reply.statusCode >= 400 ? "warn" : "info", ...log, message: "HTTP request completed", requestId: request.id });
  });
};
