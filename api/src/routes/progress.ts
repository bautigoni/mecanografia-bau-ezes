/* Progress routes — per-student level complete + per-class rollup for
 * teachers. The frontend keeps reading from localStorage; the API is the
 * canonical source for cross-device sync + teacher dashboards.
 *
 * POST /api/progress/complete is the only write the gameplay path needs:
 * one upsert per level complete, batched client-side per level. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, sql } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import type { AccessClaims } from "../auth.js";

async function requireUser(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

const completeSchema = z.object({
  worldId: z.string(),
  levelNumber: z.number().int().min(1).max(15),
  accuracy: z.number().int().min(0).max(100),
  wpm: z.number().int().min(0).optional(),
  errorCount: z.number().int().min(0).default(0),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

export async function progressRoutes(app: FastifyInstance) {
  /* ----- GET /api/progress/me ----- */
  app.get("/api/progress/me", async (req, reply) => {
    const actor = await requireUser(req);
    const rows = await db
      .select()
      .from(schema.levelProgress)
      .where(eq(schema.levelProgress.userId, actor.sub));
    return reply.send(rows);
  });

  /* ----- POST /api/progress/complete ----- */
  app.post("/api/progress/complete", async (req, reply) => {
    const actor = await requireUser(req);
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const { worldId, levelNumber, accuracy, wpm, errorCount, startedAt, endedAt } = parsed.data;
    await db
      .insert(schema.levelProgress)
      .values({
        userId: actor.sub,
        worldId,
        levelNumber,
        completed: true,
        bestAccuracy: accuracy,
        bestWpm: wpm ?? null,
        attempts: 1,
        lastAttemptAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.levelProgress.userId, schema.levelProgress.worldId, schema.levelProgress.levelNumber],
        set: {
          bestAccuracy: sql`GREATEST(${schema.levelProgress.bestAccuracy}, EXCLUDED.best_accuracy)`,
          bestWpm: sql`GREATEST(COALESCE(${schema.levelProgress.bestWpm}, 0), COALESCE(EXCLUDED.best_wpm, 0))`,
          attempts: sql`${schema.levelProgress.attempts} + 1`,
          lastAttemptAt: new Date(),
        },
      });
    await db.insert(schema.attempts).values({
      userId: actor.sub,
      worldId,
      levelNumber,
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      accuracy,
      wpm: wpm ?? null,
      errorCount,
      completed: true,
    });
    return reply.send({ ok: true });
  });

  /* ----- GET /api/teacher/students ----- */
  app.get("/api/teacher/students", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role !== "profesor" && actor.role !== "admin-sede" && actor.role !== "superadmin" && actor.role !== "admin-general") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    // Professors see students in their classes; admins see all in their scope.
    let studentIds: string[];
    if (actor.role === "profesor") {
      const rows = await db
        .select({ userId: schema.classStudents.userId })
        .from(schema.classStudents)
        .innerJoin(schema.classTeachers, eq(schema.classTeachers.classId, schema.classStudents.classId))
        .where(eq(schema.classTeachers.userId, actor.sub));
      studentIds = rows.map((r) => r.userId);
      if (studentIds.length === 0) return reply.send([]);
    } else {
      // admins: all students in their scope
      const conditions = [eq(schema.users.role, "alumno")];
      if (actor.role === "admin-sede" && actor.sede) conditions.push(eq(schema.users.sedeId, actor.sede));
      const rows = await db.select({ id: schema.users.id }).from(schema.users).where(and(...conditions));
      studentIds = rows.map((r) => r.id);
    }
    const students = await db
      .select({
        id: schema.users.id,
        fullName: schema.users.fullName,
        email: schema.users.email,
        username: schema.users.username,
        classId: schema.users.classId,
      })
      .from(schema.users)
      .where(sql`${schema.users.id} = ANY(${studentIds})`);
    const progress = await db
      .select()
      .from(schema.levelProgress)
      .where(sql`${schema.levelProgress.userId} = ANY(${studentIds})`);
    const progressByUser: Record<string, typeof progress> = {};
    for (const p of progress) {
      (progressByUser[p.userId] ??= []).push(p);
    }
    return reply.send(students.map((s) => ({ ...s, progress: progressByUser[s.id] ?? [] })));
  });
}
