/* Classes (cursos) routes — list (with roster counts), create, delete.
 * Scoped by sede: admin-sede only sees/creates within their own sede;
 * superadmin/admin-general see all. profesor/alumno are read-only via the
 * teacher endpoints, not here. */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import { canActOnSede } from "../rbac.js";
import { audit } from "../audit.js";
import type { AccessClaims } from "../auth.js";

async function requireUser(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

/** Load a class and verify the actor may act on its sede. Replies 404/403 and
 *  returns null when not allowed; otherwise returns the class row. */
async function loadOwnedClass(actor: AccessClaims, id: string, reply: FastifyReply) {
  const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
  if (!cls) {
    reply.code(404).send({ error: "Curso no encontrado." });
    return null;
  }
  if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, cls.sedeId)) {
    reply.code(403).send({ error: "No podés gestionar cursos de otra sede." });
    return null;
  }
  return cls;
}

/* Read-only access: admins by sede (as above), PLUS a profesor who is
 * explicitly assigned to this class via class_teachers — independent of
 * sede, mirroring the GET /api/classes listing rules. Used by the
 * teacher dashboard's members/progress views. Never grants writes. */
async function loadClassForRead(actor: AccessClaims, id: string, reply: FastifyReply) {
  const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, id)).limit(1);
  if (!cls) {
    reply.code(404).send({ error: "Curso no encontrado." });
    return null;
  }
  if (canActOnSede({ role: actor.role, sedeId: actor.sede }, cls.sedeId)) return cls;
  if (actor.role === "profesor" && actor.sub) {
    const [assigned] = await db
      .select({ classId: schema.classTeachers.classId })
      .from(schema.classTeachers)
      .where(and(eq(schema.classTeachers.classId, id), eq(schema.classTeachers.userId, actor.sub)))
      .limit(1);
    if (assigned) return cls;
  }
  reply.code(403).send({ error: "No podés ver cursos de otra sede." });
  return null;
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  sedeId: z.string().uuid().optional(),
  grade: z.enum(["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"]).optional(),
});

export async function classRoutes(app: FastifyInstance) {
  /* ----- GET /api/classes?sedeId=&includeArchived= ----- */
  app.get("/api/classes", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });

    const { sedeId, includeArchived } = req.query as { sedeId?: string; includeArchived?: string };
    const conditions = [];
    if (actor.role === "admin-sede") {
      if (!actor.sede) return reply.send([]);
      conditions.push(eq(schema.classes.sedeId, actor.sede));
    } else if (actor.role === "profesor") {
      // Teachers only see the classes they are explicitly assigned to via
      // class_teachers — independent of sede, so a profesor that works in
      // varias sedes (or has no sede binding) still sees all their courses.
      if (!actor.sub) return reply.send([]);
      const assigned = await db
        .select({ classId: schema.classTeachers.classId })
        .from(schema.classTeachers)
        .where(eq(schema.classTeachers.userId, actor.sub));
      const ids = assigned.map((r) => r.classId);
      if (!ids.length) return reply.send([]);
      conditions.push(inArray(schema.classes.id, ids));
    } else if (sedeId) {
      conditions.push(eq(schema.classes.sedeId, sedeId));
    }
    // F6: archived classes are hidden by default; pass ?includeArchived=1
    // to surface them (for the "cursos archivados" view in the sede config).
    if (!includeArchived) conditions.push(eq(schema.classes.status, "active"));
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
        academicYearId: c.academicYearId,
        status: c.status,
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
    // Un curso nuevo nace en el año lectivo ACTIVO de la sede. Si quedara en
    // NULL desaparecería de los listados filtrados por año hasta el próximo
    // reinicio del API (el backfill de ensureSchema corre solo en el boot).
    const [activeYear] = await db
      .select({ id: schema.academicYears.id })
      .from(schema.academicYears)
      .where(and(eq(schema.academicYears.sedeId, sedeId), eq(schema.academicYears.isActive, true)))
      .limit(1);
    const [row] = await db
      .insert(schema.classes)
      .values({ name: parsed.data.name, sedeId, grade: parsed.data.grade ?? "libre", academicYearId: activeYear?.id ?? null })
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
    await audit({ actor, action: "delete_class", entityType: "class", entityId: id, meta: { name: target.name } });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/classes/:id/archive (F6) ----- */
  app.post("/api/classes/:id/archive", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    if (cls.status === "archived") return reply.send({ ok: true, alreadyArchived: true });
    await db
      .update(schema.classes)
      .set({ status: "archived", active: false, updatedAt: new Date() })
      .where(eq(schema.classes.id, id));
    await audit({ actor, action: "archive_class", entityType: "class", entityId: id, meta: { name: cls.name } });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/classes/:id/reactivate (F6) ----- */
  app.post("/api/classes/:id/reactivate", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    await db
      .update(schema.classes)
      .set({ status: "active", active: true, updatedAt: new Date() })
      .where(eq(schema.classes.id, id));
    await audit({ actor, action: "reactivate_class", entityType: "class", entityId: id, meta: { name: cls.name } });
    return reply.send({ ok: true });
  });

  /* ----- PATCH /api/classes/:id (rename / grade) ----- */
  app.patch("/api/classes/:id", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    const parsed = z.object({ name: z.string().trim().min(1).optional(), grade: createSchema.shape.grade }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const [row] = await db
      .update(schema.classes)
      .set({ name: parsed.data.name ?? cls.name, grade: parsed.data.grade ?? cls.grade })
      .where(eq(schema.classes.id, id))
      .returning();
    return reply.send({ id: row!.id, name: row!.name, grade: row!.grade, sedeId: row!.sedeId });
  });

  /* ----- GET /api/classes/:id/members (teachers + students) ----- */
  app.get("/api/classes/:id/members", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const cls = await loadClassForRead(actor, id, reply);
    if (!cls) return;
    const cols = {
      id: schema.users.id,
      fullName: schema.users.fullName,
      email: schema.users.email,
      username: schema.users.username,
      lastLoginAt: schema.users.lastLoginAt,
    };
    const teachers = await db
      .select(cols)
      .from(schema.classTeachers)
      .innerJoin(schema.users, eq(schema.users.id, schema.classTeachers.userId))
      .where(eq(schema.classTeachers.classId, id))
      .orderBy(schema.users.fullName);
    const students = await db
      .select(cols)
      .from(schema.classStudents)
      .innerJoin(schema.users, eq(schema.users.id, schema.classStudents.userId))
      .where(eq(schema.classStudents.classId, id))
      .orderBy(schema.users.fullName);
    return reply.send({
      class: { id: cls.id, name: cls.name, grade: cls.grade, sedeId: cls.sedeId },
      teachers,
      students,
    });
  });

  /* ----- POST /api/classes/:id/teachers (assign a teacher) ----- */
  app.post("/api/classes/:id/teachers", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Falta el docente." });
    const [t] = await db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).limit(1);
    if (!t || t.role !== "profesor") return reply.code(400).send({ error: "El usuario no es un docente." });
    // Un docente sin sede (p. ej. una invitación aceptada sin sede asociada)
    // adopta la sede del curso al ser asignado. Cross-sede sigue bloqueado
    // para admin-sede; superadmin/admin-general pueden asignar de cualquiera.
    if (t.sedeId && !canActOnSede({ role: actor.role, sedeId: actor.sede }, t.sedeId)) {
      return reply.code(403).send({ error: "El docente es de otra sede." });
    }
    if (!t.sedeId) {
      await db.update(schema.users).set({ sedeId: cls.sedeId }).where(eq(schema.users.id, t.id));
    }
    await db.insert(schema.classTeachers).values({ classId: id, userId: parsed.data.userId }).onConflictDoNothing();
    return reply.send({ ok: true });
  });

  /* ----- DELETE /api/classes/:id/teachers/:userId (unassign) ----- */
  app.delete("/api/classes/:id/teachers/:userId", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });
    const { id, userId } = req.params as { id: string; userId: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    await db
      .delete(schema.classTeachers)
      .where(and(eq(schema.classTeachers.classId, id), eq(schema.classTeachers.userId, userId)));
    return reply.send({ ok: true });
  });

  /* ----- GET /api/classes/:id/worlds (enabled level-worlds; null = all) ----- */
  app.get("/api/classes/:id/worlds", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    const rows = await db.select().from(schema.classWorlds).where(eq(schema.classWorlds.classId, id));
    return reply.send({ worldIds: rows.length ? rows.filter((r) => r.isEnabled).map((r) => r.worldId) : null });
  });

  /* ----- PUT /api/classes/:id/worlds (replace the enabled set) ----- */
  app.put("/api/classes/:id/worlds", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    const parsed = z.object({ worldIds: z.array(z.string()).max(50) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    await db.delete(schema.classWorlds).where(eq(schema.classWorlds.classId, id));
    if (parsed.data.worldIds.length) {
      await db.insert(schema.classWorlds).values(parsed.data.worldIds.map((w) => ({ classId: id, worldId: w, isEnabled: true })));
    }
    return reply.send({ ok: true });
  });

  /* ----- POST /api/classes/:id/students (move/assign an existing student) ----- */
  app.post("/api/classes/:id/students", async (req, reply) => {
    const actor = await requireUser(req);
    if (actor.role === "profesor" || actor.role === "alumno") return reply.code(403).send({ error: "No autorizado." });
    const { id } = req.params as { id: string };
    const cls = await loadOwnedClass(actor, id, reply);
    if (!cls) return;
    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Falta el alumno." });
    const [s] = await db.select().from(schema.users).where(eq(schema.users.id, parsed.data.userId)).limit(1);
    if (!s || s.role !== "alumno") return reply.code(400).send({ error: "El usuario no es un alumno." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, s.sedeId)) {
      return reply.code(403).send({ error: "El alumno es de otra sede." });
    }
    // Move: drop from any class roster, attach to this one, set primary classId.
    await db.delete(schema.classStudents).where(eq(schema.classStudents.userId, parsed.data.userId));
    await db.insert(schema.classStudents).values({ classId: id, userId: parsed.data.userId }).onConflictDoNothing();
    await db.update(schema.users).set({ classId: id }).where(eq(schema.users.id, parsed.data.userId));
    return reply.send({ ok: true });
  });

  /* ----- GET /api/classes/:id/progress (per-student aggregate for heatmap) ----- */
  app.get("/api/classes/:id/progress", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const cls = await loadClassForRead(actor, id, reply);
    if (!cls) return;

    const roster = await db
      .select({ id: schema.users.id, fullName: schema.users.fullName, username: schema.users.username })
      .from(schema.classStudents)
      .innerJoin(schema.users, eq(schema.users.id, schema.classStudents.userId))
      .where(eq(schema.classStudents.classId, id))
      .orderBy(schema.users.fullName);

    const ids = roster.map((r) => r.id);
    const prog = ids.length
      ? await db
          .select({
            userId: schema.levelProgress.userId,
            worldId: schema.levelProgress.worldId,
            completed: schema.levelProgress.completed,
            bestAccuracy: schema.levelProgress.bestAccuracy,
            lastAttemptAt: schema.levelProgress.lastAttemptAt,
          })
          .from(schema.levelProgress)
          .where(inArray(schema.levelProgress.userId, ids))
      : [];

    const byUser = new Map<string, typeof prog>();
    for (const p of prog) {
      const arr = byUser.get(p.userId) ?? [];
      arr.push(p);
      byUser.set(p.userId, arr);
    }

    const students = roster.map((r) => {
      const rows = byUser.get(r.id) ?? [];
      const byWorld: Record<string, { completed: number; avgAccuracy: number }> = {};
      let lastActivity: string | null = null;
      let completedLevels = 0;
      let accSum = 0;
      for (const p of rows) {
        const w = (byWorld[p.worldId] ??= { completed: 0, avgAccuracy: 0 });
        if (p.completed) { w.completed += 1; completedLevels += 1; }
        w.avgAccuracy += p.bestAccuracy;
        accSum += p.bestAccuracy;
        const t = p.lastAttemptAt ? new Date(p.lastAttemptAt).toISOString() : null;
        if (t && (!lastActivity || t > lastActivity)) lastActivity = t;
      }
      for (const w of Object.values(byWorld)) w.avgAccuracy = Math.round(w.avgAccuracy / Math.max(1, rows.filter((x) => byWorld[x.worldId] === w).length));
      const worldsWithProgress = Object.keys(byWorld);
      const currentWorld = worldsWithProgress
        .map((w) => Number(w.replace("island", "")) || 0)
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        id: r.id,
        fullName: r.fullName,
        username: r.username,
        lastActivity,
        completedLevels,
        avgAccuracy: rows.length ? Math.round(accSum / rows.length) : 0,
        currentWorld: currentWorld ? `island${currentWorld}` : null,
        byWorld,
      };
    });

    return reply.send({ students });
  });
}
