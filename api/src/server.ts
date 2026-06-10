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
  /* F5 — gamification tables. */
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

  /* F6 — academic year + soft-delete + audit log. */
  /* Postgres does NOT support `CREATE TYPE ... IF NOT EXISTS` for enums
   * (the IF NOT EXISTS form is rejected with `syntax error at or near
   * "NOT"`), so we guard with a pg_type lookup. Idempotent on every boot. */
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
        CREATE TYPE class_status AS ENUM ('active', 'archived');
      END IF;
    END $$`);
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE TYPE enrollment_status AS ENUM ('cursando', 'promovido', 'egresado', 'retirado');
      END IF;
    END $$`);

  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_deleted ON users (deleted_at) WHERE deleted_at IS NULL`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS academic_years (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sede_id uuid NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
      label text NOT NULL,
      starts_at date,
      ends_at date,
      is_active boolean NOT NULL DEFAULT false,
      closed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_years_sede_label_unique
      ON academic_years (sede_id, label)`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_academic_years_sede ON academic_years (sede_id)`);

  await db.execute(sql`
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL`);
  await db.execute(sql`
    ALTER TABLE classes ADD COLUMN IF NOT EXISTS status class_status NOT NULL DEFAULT 'active'`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_classes_year ON classes (academic_year_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS class_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      status enrollment_status NOT NULL DEFAULT 'cursando',
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz
    );`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments (student_id)`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments (class_id)`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_class_enrollments_year ON class_enrollments (academic_year_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id bigserial PRIMARY KEY,
      actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
      sede_id uuid REFERENCES sedes(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      meta text,
      at timestamptz NOT NULL DEFAULT now()
    );`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_sede ON audit_log (sede_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_id)`);

  /* One-shot backfill: make sure every sede has an active academic year
     (the current calendar year) and every existing class + student
     enrollment points at it. Safe to re-run: it only inserts when the
     year row doesn't exist. */
  const year = String(new Date().getUTCFullYear());
  await db.execute(sql`
    INSERT INTO academic_years (sede_id, label, is_active, starts_at, ends_at)
    SELECT s.id, ${year}, true, make_date(${year}::int, 3, 1), make_date(${year}::int + 1, 2, 28)
    FROM sedes s
    WHERE NOT EXISTS (
      SELECT 1 FROM academic_years ay
      WHERE ay.sede_id = s.id AND ay.label = ${year}
    )
    ON CONFLICT (sede_id, label) DO NOTHING`);
  await db.execute(sql`
    UPDATE classes c
    SET academic_year_id = ay.id
    FROM academic_years ay
    WHERE c.academic_year_id IS NULL
      AND c.sede_id = ay.sede_id
      AND ay.is_active = true`);
  /* Backfill enrollments for every current roster link. */
  await db.execute(sql`
    INSERT INTO class_enrollments (student_id, class_id, academic_year_id, status)
    SELECT cs.user_id, cs.class_id, c.academic_year_id, 'cursando'::enrollment_status
    FROM class_students cs
    INNER JOIN classes c ON c.id = cs.class_id
    WHERE c.academic_year_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM class_enrollments ce
        WHERE ce.student_id = cs.user_id
          AND ce.class_id = cs.class_id
          AND ce.academic_year_id = c.academic_year_id
      )`);
}
import { sedeRoutes } from "./routes/sedes.js";
import { userRoutes } from "./routes/users.js";
import { progressRoutes } from "./routes/progress.js";
import { importRoutes } from "./routes/import.js";
import { invitationRoutes } from "./routes/invitations.js";
import { classRoutes } from "./routes/classes.js";
import { adminRoutes } from "./routes/admin.js";
import { academicYearRoutes } from "./routes/academicYears.js";
import { inspectorRoutes, registerRoute, recordError } from "./routes/inspector.js";

const PORT = Number(process.env.PORT ?? 3000);
const ORIGIN = process.env.CORS_ORIGIN ?? "https://typely.bauhub.online";

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

  /* Inventario de rutas para el inspector de API (/api/admin/inspector).
     El hook tiene que registrarse ANTES de las rutas para verlas todas. */
  app.addHook("onRoute", (route) => {
    registerRoute(route.method as string | string[], route.url);
  });

  /* Apply post-001 migrations (gamification / academic-year tables, etc.). */
  try {
    await ensureSchema();
  } catch (e) {
    app.log.error({ err: e }, "ensureSchema failed");
  }

  /* Top-level error handler: never leak stack traces, always Spanish.
     IMPORTANT: must be set BEFORE registering the route plugins — Fastify
     only propagates a custom error handler to child contexts created
     after it is set. (Set after the routes, every thrown 401/403 fell
     through to Fastify's default English `{statusCode,error,message}`.) */
  app.setErrorHandler((err, req, reply) => {
    const status = (err as any).status ?? (err as any).statusCode ?? 500;
    if (status >= 500) app.log.error({ err }, "unhandled error");
    recordError({
      at: new Date().toISOString(),
      status,
      method: req.method,
      url: req.url,
      message: status >= 500 ? "Error interno del servidor." : err.message,
    });
    reply.code(status).send({
      error: status >= 500 ? "Error interno del servidor." : err.message,
    });
  });

  /* Health check — used by the Caddy reverse-proxy to know we're up.
     Also exposed as /api/health so the PUBLIC https://…/api/health probe
     works through Caddy (which proxies /api/* preserving the path). */
  const health = async () => ({ ok: true, service: "typely-api", ts: new Date().toISOString() });
  app.get("/health", health);
  app.get("/api/health", health);

  /* Domain routes */
  await app.register(authRoutes);
  await app.register(sedeRoutes);
  await app.register(userRoutes);
  await app.register(progressRoutes);
  await app.register(importRoutes);
  await app.register(invitationRoutes);
  await app.register(classRoutes);
  await app.register(adminRoutes);
  await app.register(academicYearRoutes);
  await app.register(inspectorRoutes);

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
