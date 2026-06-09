/* TYPELY API — Fastify server entry.
 *
 * Responsibilities:
 *   - Boot Fastify with cookie + CORS support
 *   - Register all route modules
 *   - Health check at /health
 *   - Top-level error handler that translates to friendly Spanish JSON
 *   - Graceful shutdown so the container can roll without dropping requests
 */

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { authRoutes } from "./routes/auth.js";

/* Idempotent migration for tables added after the initial 001_schema.sql
   (which only runs on a fresh DB). Safe to run on every boot. */
async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS student_stats (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      xp integer NOT NULL DEFAULT 0,
      stars integer NOT NULL DEFAULT 0,
      levels_completed integer NOT NULL DEFAULT 0,
      streak_days integer NOT NULL DEFAULT 0,
      longest_streak integer NOT NULL DEFAULT 0,
      last_active_day date,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS student_achievements (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id text NOT NULL,
      unlocked_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, achievement_id)
    );`);
}
import { sedeRoutes } from "./routes/sedes.js";
import { userRoutes } from "./routes/users.js";
import { progressRoutes } from "./routes/progress.js";
import { importRoutes } from "./routes/import.js";
import { invitationRoutes } from "./routes/invitations.js";
import { classRoutes } from "./routes/classes.js";
import { adminRoutes } from "./routes/admin.js";

const PORT = Number(process.env.PORT ?? 3000);
const ORIGIN = process.env.CORS_ORIGIN ?? "https://mecanografia.bauhub.online";

async function main() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true, // behind Caddy
    bodyLimit: 1 * 1024 * 1024, // 1 MB — enough for CSV imports later
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: ORIGIN,
    credentials: true,
  });

  /* Apply post-001 migrations (gamification / academic-year tables, etc.). */
  try {
    await ensureSchema();
  } catch (e) {
    app.log.error({ err: e }, "ensureSchema failed");
  }

  /* Health check — used by the Caddy reverse-proxy to know we're up. */
  app.get("/health", async () => ({ ok: true, service: "typely-api", ts: new Date().toISOString() }));

  /* Domain routes */
  await app.register(authRoutes);
  await app.register(sedeRoutes);
  await app.register(userRoutes);
  await app.register(progressRoutes);
  await app.register(importRoutes);
  await app.register(invitationRoutes);
  await app.register(classRoutes);
  await app.register(adminRoutes);

  /* Top-level error handler: never leak stack traces, always Spanish. */
  app.setErrorHandler((err, _req, reply) => {
    const status = (err as any).status ?? 500;
    if (status >= 500) app.log.error({ err }, "unhandled error");
    reply.code(status).send({
      error: status >= 500 ? "Error interno del servidor." : err.message,
    });
  });

  /* Graceful shutdown. */
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    try { await app.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`typely-api listening on :${PORT}`);
}

main().catch((err) => {
  console.error("fatal startup error", err);
  process.exit(1);
});
