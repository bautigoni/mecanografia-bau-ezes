/* Academic year (Año lectivo) — F6.
 *
 *   GET    /api/academic-years?sedeId=           list years for a sede
 *   POST   /api/academic-years                   create a new year
 *   PATCH  /api/academic-years/:id/activate      mark as the active one
 *   POST   /api/academic-years/:id/close         close year (transactional)
 *
 * Closing a year is the most dangerous operation in the system:
 *   - all `active` courses of the year are marked `archived`,
 *   - the active flag on the year is cleared,
 *   - we try to promote each student into the matching course of the
 *     target year (configurable via ?promotion=map),
 *   - everything is wrapped in a single DB transaction so a failure rolls
 *     back the whole thing.
 *
 * The promotion matrix is passed in the request body:
 *   { promotion: { "1ep": "2ep", "2ep": "3ep", ..., "sec": "egresado" } }
 * Missing source grades default to "promoted to same grade" and a missing
 * target graduates them. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, sql } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import { canActOnSede } from "../rbac.js";
import { audit } from "../audit.js";
import type { AccessClaims } from "../auth.js";

const GRADES = ["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"] as const;
type Grade = (typeof GRADES)[number];

const PROMOTION: Record<Grade, Grade | "egresado"> = {
  inicial: "1ep",
  "1ep": "2ep",
  "2ep": "3ep",
  "3ep": "4ep",
  "4ep": "5ep",
  "5ep": "6ep",
  "6ep": "sec",
  sec: "egresado",
  libre: "libre",
};

async function requireStaff(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

export async function academicYearRoutes(app: FastifyInstance) {
  /* ----- GET /api/academic-years?sedeId= ----- */
  app.get("/api/academic-years", async (req, reply) => {
    const actor = await requireStaff(req);
    const { sedeId } = req.query as { sedeId?: string };
    const target = actor.role === "admin-sede" ? actor.sede : sedeId;
    if (!target) return reply.send([]);
    const rows = await db
      .select()
      .from(schema.academicYears)
      .where(eq(schema.academicYears.sedeId, target))
      .orderBy(sql`${schema.academicYears.label} desc`);
    return reply.send(rows);
  });

  /* ----- GET /api/academic-years/:id/close-preview (F6: impact preview) ----- */
  app.get("/api/academic-years/:id/close-preview", async (req, reply) => {
    const actor = await requireStaff(req);
    const { id } = req.params as { id: string };
    const [year] = await db.select().from(schema.academicYears).where(eq(schema.academicYears.id, id)).limit(1);
    if (!year) return reply.code(404).send({ error: "Año no encontrado." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, year.sedeId)) {
      return reply.code(403).send({ error: "El año es de otra sede." });
    }
    // Courses of the year (will archive).
    const yearClasses = await db
      .select({ id: schema.classes.id, grade: schema.classes.grade })
      .from(schema.classes)
      .where(eq(schema.classes.academicYearId, id));
    const yearClassIds = yearClasses.map((c) => c.id);
    // Enrollments of the year (will close + try to promote).
    const enrollments = yearClassIds.length
      ? await db
          .select({ id: schema.classEnrollments.id, classId: schema.classEnrollments.classId })
          .from(schema.classEnrollments)
          .where(eq(schema.classEnrollments.academicYearId, id))
      : [];
    // Per-grade student breakdown for the promotion matrix preview.
    const byGrade: Record<string, number> = {};
    for (const en of enrollments) {
      const cls = yearClasses.find((c) => c.id === en.classId);
      const g = cls?.grade ?? "libre";
      byGrade[g] = (byGrade[g] ?? 0) + 1;
    }
    // Look for the next year by label (e.g. 2026 → 2027).
    const nextLabel = String(Number(year.label) + 1);
    const [target] = await db
      .select()
      .from(schema.academicYears)
      .where(and(eq(schema.academicYears.sedeId, year.sedeId), eq(schema.academicYears.label, nextLabel)))
      .limit(1);
    return reply.send({
      year: { id: year.id, label: year.label, courseCount: yearClasses.length, studentCount: enrollments.length },
      target: target ? { id: target.id, label: target.label } : null,
      byGrade,
    });
  });

  /* ----- POST /api/academic-years ----- */
  app.post("/api/academic-years", async (req, reply) => {
    const actor = await requireStaff(req);
    if (actor.role === "alumno" || actor.role === "profesor") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const body = z
      .object({ label: z.string().trim().min(1).max(20), startsAt: z.string().optional(), endsAt: z.string().optional(), sedeId: z.string().uuid().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos." });
    const sedeId = actor.role === "admin-sede" ? actor.sede : body.data.sedeId ?? actor.sede;
    if (!sedeId) return reply.code(400).send({ error: "Falta la sede." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, sedeId)) {
      return reply.code(403).send({ error: "No podés crear años en otra sede." });
    }
    // Insert as inactive; activation is a separate step so the user can
    // review / invite admins before flipping the switch.
    try {
      const [row] = await db
        .insert(schema.academicYears)
        .values({ sedeId, label: body.data.label, startsAt: body.data.startsAt ?? null, endsAt: body.data.endsAt ?? null, isActive: false })
        .returning();
      await audit({ actor, action: "create_academic_year", entityType: "academic_year", entityId: row!.id, meta: { label: body.data.label, sedeId } });
      return reply.send(row);
    } catch (e: any) {
      if (e?.code === "23505") return reply.code(409).send({ error: "Ya existe un año con esa etiqueta." });
      throw e;
    }
  });

  /* ----- PATCH /api/academic-years/:id/activate ----- */
  app.patch("/api/academic-years/:id/activate", async (req, reply) => {
    const actor = await requireStaff(req);
    if (actor.role === "alumno" || actor.role === "profesor") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { id } = req.params as { id: string };
    const [year] = await db.select().from(schema.academicYears).where(eq(schema.academicYears.id, id)).limit(1);
    if (!year) return reply.code(404).send({ error: "Año lectivo no encontrado." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, year.sedeId)) {
      return reply.code(403).send({ error: "El año es de otra sede." });
    }
    // Only ONE active year per sede — flip every sibling off first.
    await db
      .update(schema.academicYears)
      .set({ isActive: false })
      .where(eq(schema.academicYears.sedeId, year.sedeId));
    await db.update(schema.academicYears).set({ isActive: true }).where(eq(schema.academicYears.id, id));
    await audit({ actor, action: "activate_academic_year", entityType: "academic_year", entityId: id, meta: { label: year.label, sedeId: year.sedeId } });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/academic-years/:id/close (the big one) ----- */
  app.post("/api/academic-years/:id/close", async (req, reply) => {
    const actor = await requireStaff(req);
    if (actor.role !== "superadmin" && actor.role !== "admin-general") {
      return reply.code(403).send({ error: "Solo el superadmin puede cerrar un año lectivo." });
    }
    const { id } = req.params as { id: string };
    const body = z
      .object({
        targetYearId: z.string().uuid().optional(),
        // Optional map of source grade → target grade | "egresado".
        promotion: z.record(z.string(), z.string()).optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos." });

    const [year] = await db.select().from(schema.academicYears).where(eq(schema.academicYears.id, id)).limit(1);
    if (!year) return reply.code(404).send({ error: "Año lectivo no encontrado." });
    if (year.closedAt) return reply.code(409).send({ error: "El año ya estaba cerrado." });

    const promotion: Record<string, string | "egresado"> = { ...PROMOTION, ...(body.data.promotion ?? {}) } as any;

    // The new year must already exist (we don't auto-create — too risky).
    let targetYear = body.data.targetYearId
      ? (await db.select().from(schema.academicYears).where(eq(schema.academicYears.id, body.data.targetYearId)).limit(1))[0] ?? null
      : null;
    if (!targetYear) {
      // Look for the next year by label (2026 → 2027).
      const next = String(Number(year.label) + 1);
      const [found] = await db
        .select()
        .from(schema.academicYears)
        .where(and(eq(schema.academicYears.sedeId, year.sedeId), eq(schema.academicYears.label, next)))
        .limit(1);
      targetYear = found ?? null;
    }

    try {
      const result = await db.transaction(async (tx) => {
        // 1) Mark all courses of the year as archived.
        const closing = await tx
          .update(schema.classes)
          .set({ status: "archived", active: false })
          .where(eq(schema.classes.academicYearId, id))
          .returning({ id: schema.classes.id, name: schema.classes.name });

        // 2) Close every enrollment of the year.
        await tx
          .update(schema.classEnrollments)
          .set({ status: "promovido", endedAt: new Date() })
          .where(eq(schema.classEnrollments.academicYearId, id));

        // 3) Promotion: if there's a target year, create a fresh
        //    enrollment per (student, target course) using the
        //    configured matrix; otherwise mark the student as graduated.
        let promoted = 0;
        let graduated = 0;
        let skipped = 0;
        if (targetYear) {
          const archivedClasses = await tx
            .select({ id: schema.classes.id, grade: schema.classes.grade })
            .from(schema.classes)
            .where(eq(schema.classes.academicYearId, id));
          const gradeToClass = new Map<string, string[]>();
          for (const c of archivedClasses) {
            const arr = gradeToClass.get(c.grade) ?? [];
            arr.push(c.id);
            gradeToClass.set(c.grade, arr);
          }
          // For each student, look at their roster of the year being
          // closed and try to put them in a target course of the right
          // grade (creating one if necessary).
          const enrollments = await tx
            .select()
            .from(schema.classEnrollments)
            .where(eq(schema.classEnrollments.academicYearId, id));
          for (const en of enrollments) {
            const [student] = await tx
              .select({ grade: schema.users.grade, classId: schema.users.classId })
              .from(schema.users)
              .where(eq(schema.users.id, en.studentId))
              .limit(1);
            if (!student) { skipped++; continue; }
            const srcClass = archivedClasses.find((c) => c.id === en.classId);
            const targetGrade = promotion[srcClass?.grade ?? student.grade] ?? student.grade;
            if (targetGrade === "egresado") {
              // Mark the student as graduated (no class assignment).
              await tx.update(schema.users).set({ classId: null }).where(eq(schema.users.id, en.studentId));
              graduated++;
              continue;
            }
            const targetClasses = gradeToClass.get(targetGrade) ?? [];
            let targetClassId = targetClasses[0] ?? null;
            if (!targetClassId) {
              const [created] = await tx
                .insert(schema.classes)
                .values({
                  sedeId: year.sedeId,
                  name: `${targetGrade.toUpperCase()} ${targetYear!.label}`,
                  grade: targetGrade as any,
                  academicYearId: targetYear!.id,
                })
                .returning({ id: schema.classes.id });
              targetClassId = created!.id;
              targetClasses.push(targetClassId);
              gradeToClass.set(targetGrade, targetClasses);
            }
            await tx
              .insert(schema.classEnrollments)
              .values({ studentId: en.studentId, classId: targetClassId, academicYearId: targetYear!.id, status: "cursando" })
              .onConflictDoNothing();
            await tx.insert(schema.classStudents).values({ classId: targetClassId, userId: en.studentId }).onConflictDoNothing();
            await tx.update(schema.users).set({ classId: targetClassId }).where(eq(schema.users.id, en.studentId));
            promoted++;
          }
        }

        // 4) Flip the year flags.
        await tx.update(schema.academicYears).set({ isActive: false, closedAt: new Date() }).where(eq(schema.academicYears.id, id));
        if (targetYear) await tx.update(schema.academicYears).set({ isActive: true }).where(eq(schema.academicYears.id, targetYear.id));

        return { closedCourses: closing.length, promoted, graduated, targetYear };
      });
      await audit({
        actor,
        action: "close_academic_year",
        entityType: "academic_year",
        entityId: id,
        meta: { label: year.label, targetYearId: targetYear?.id ?? null, closedCourses: result.closedCourses, promoted: result.promoted, graduated: result.graduated },
      });
      return reply.send({
        ok: true,
        closedCourses: result.closedCourses,
        promoted: result.promoted,
        graduated: result.graduated,
        targetYear: result.targetYear ? { id: result.targetYear.id, label: result.targetYear.label } : null,
      });
    } catch (e: any) {
      app.log.error({ err: e }, "close year failed");
      return reply.code(500).send({ error: "No se pudo cerrar el año. Probá de nuevo." });
    }
  });
}
