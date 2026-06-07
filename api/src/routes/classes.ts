/* Classes (cursos) routes — list (with roster counts), create, delete.
 * Scoped by sede: admin-sede only sees/creates within their own sede;
 * superadmin/admin-general see all. profesor/alumno are read-only via the
 * teacher endpoints, not here. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import { canActOnSede } from "../rbac.js";
import type { AccessClaims } from "../auth.js";

async function requireUser(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  sedeId: z.string().uuid().optional(),
  grade: z.enum(["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"]).optional(),
});

export async function classRoutes(app: FastifyInstance) {
  /* ----- GET /api/classes?sedeId= ----- */
  app.get("/api/classes", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });

    const { sedeId } = req.query as { sedeId?: string };
    const conditions = [];
    if (actor.role === "admin-sede" || actor.role === "profesor") {
      if (!actor.sede) return reply.send([]);
      conditions.push(eq(schema.classes.sedeId, actor.sede));
    } else if (sedeId) {
      conditions.push(eq(schema.classes.sedeId, sedeId));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(schema.classes).where(where as any).orderBy(schema.classes.name);

    const [studentCounts, teacherCounts] = await Promise.all([
      db
        .select({ classId: schema.classStudents.classId, n: sql<number>`count(*)::int` })
        .from(schema.classStudents)
        .groupBy(schema.classStudents.classId),
      db
        .select({ classId: schema.classTeachers.classId, n: sql<number>`count(*)::int` })
        .from(schema.classTeachers)
        .groupBy(schema.classTeachers.classId),
    ]);
    const sMap = new Map(studentCounts.map((r) => [r.classId, Number(r.n)]));
    const tMap = new Map(teacherCounts.map((r) => [r.classId, Number(r.n)]));

    return reply.send(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        sedeId: c.sedeId,
        studentCount: sMap.get(c.id) ?? 0,
        teacherCount: tMap.get(c.id) ?? 0,
      })),
    );
  });

  /* ----- POST /api/classes ----- */
  app.post("/api/classes", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const sedeId = actor.role === "admin-sede" ? actor.sede : parsed.data.sedeId ?? actor.sede;
    if (!sedeId) return reply.code(400).send({ error: "Falta la sede." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, sedeId)) {
      return reply.code(403).send({ error: "No podés crear cursos en otra sede." });
    }
    const [row] = await db
      .insert(schema.classes)
      .values({ name: parsed.data.name, sedeId, grade: parsed.data.grade ?? "libre" })
      .returning();
    return reply.send({ id: row!.id, name: row!.name, grade: row!.grade, sedeId: row!.sedeId, studentCount: 0, teacherCount: 0 });
  });

  /* ----- DELETE /api/classes/:id ----- */
  app.delete("/api/classes/:id", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const [target] = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
    if (!target) return reply.code(404).send({ error: "Curso no encontrado." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "No podés eliminar cursos de otra sede." });
    }
    await db.delete(schema.classes).where(eq(schema.classes.id, id));
    return reply.send({ ok: true });
  });
}
