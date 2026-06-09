/* Admin dashboard aggregation — one call powers the Inicio executive
 * dashboard (KPIs + weekly activity + alerts + attention courses + recent
 * activity). Scoped to the actor's sede (superadmin may pass ?sedeId). */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, gte, sql, desc } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import type { AccessClaims } from "../auth.js";

async function requireStaff(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  const claims = await verifyAccessToken(auth.slice("Bearer ".length));
  if (claims.role === "alumno" || claims.role === "profesor") {
    throw Object.assign(new Error("No autorizado."), { status: 403 });
  }
  return claims;
}

const DAY = 86400000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/overview", async (req, reply) => {
    const actor = await requireStaff(req);
    const q = req.query as { sedeId?: string };
    const sedeId = actor.role === "admin-sede" ? actor.sede : q.sedeId ?? actor.sede;
    if (!sedeId) {
      return reply.send({
        counts: { courses: 0, teachers: 0, students: 0 },
        activeToday: 0, avgProgress: 0, weekly: [], alerts: {}, attentionCourses: [], recent: [],
      });
    }

    const [courses, teachers, students] = await Promise.all([
      db.select({ id: schema.classes.id, name: schema.classes.name }).from(schema.classes).where(eq(schema.classes.sedeId, sedeId)),
      db.select({ id: schema.users.id, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).where(and(eq(schema.users.role, "profesor"), eq(schema.users.sedeId, sedeId))),
      db.select({ id: schema.users.id, fullName: schema.users.fullName }).from(schema.users).where(and(eq(schema.users.role, "alumno"), eq(schema.users.sedeId, sedeId))),
    ]);
    const studentIds = students.map((s) => s.id);
    const nameById = new Map(students.map((s) => [s.id, s.fullName]));
    const courseIds = courses.map((c) => c.id);

    const now = Date.now();
    const since7 = new Date(now - 7 * DAY);
    const since14 = new Date(now - 14 * DAY);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    /* Per-student last attempt + per-student avg accuracy + overall avg. */
    const [lastAttempts, perUserAcc, recent, weeklyRows, teacherCounts] = await Promise.all([
      studentIds.length
        ? db.select({ userId: schema.attempts.userId, last: sql<string>`max(${schema.attempts.endedAt})` }).from(schema.attempts).where(inArray(schema.attempts.userId, studentIds)).groupBy(schema.attempts.userId)
        : Promise.resolve([] as { userId: string; last: string }[]),
      studentIds.length
        ? db.select({ userId: schema.levelProgress.userId, avg: sql<number>`round(avg(${schema.levelProgress.bestAccuracy}))::int`, done: sql<number>`count(*) filter (where ${schema.levelProgress.completed})::int` }).from(schema.levelProgress).where(inArray(schema.levelProgress.userId, studentIds)).groupBy(schema.levelProgress.userId)
        : Promise.resolve([] as { userId: string; avg: number; done: number }[]),
      studentIds.length
        ? db.select({ userId: schema.attempts.userId, worldId: schema.attempts.worldId, endedAt: schema.attempts.endedAt, completed: schema.attempts.completed }).from(schema.attempts).where(inArray(schema.attempts.userId, studentIds)).orderBy(desc(schema.attempts.endedAt)).limit(8)
        : Promise.resolve([] as { userId: string; worldId: string; endedAt: string; completed: boolean }[]),
      studentIds.length
        ? db.select({ day: sql<string>`to_char(date_trunc('day', ${schema.attempts.endedAt}), 'YYYY-MM-DD')`, c: sql<number>`count(*)::int` }).from(schema.attempts).where(and(inArray(schema.attempts.userId, studentIds), gte(schema.attempts.endedAt, since7))).groupBy(sql`date_trunc('day', ${schema.attempts.endedAt})`)
        : Promise.resolve([] as { day: string; c: number }[]),
      courseIds.length
        ? db.select({ classId: schema.classTeachers.classId, n: sql<number>`count(*)::int` }).from(schema.classTeachers).where(inArray(schema.classTeachers.classId, courseIds)).groupBy(schema.classTeachers.classId)
        : Promise.resolve([] as { classId: string; n: number }[]),
    ]);

    const lastById = new Map(lastAttempts.map((r) => [r.userId, new Date(r.last).getTime()]));
    const accById = new Map(perUserAcc.map((r) => [r.userId, r.avg]));
    const teacherCountById = new Map(teacherCounts.map((r) => [r.classId, r.n]));

    /* Overall avg progress (avg of per-student avg accuracy). */
    const avgProgress = perUserAcc.length ? Math.round(perUserAcc.reduce((a, r) => a + r.avg, 0) / perUserAcc.length) : 0;
    const activeToday = [...lastById.values()].filter((t) => t >= startToday.getTime()).length;

    /* Weekly activity: fill the last 7 days with zeros. */
    const weeklyMap = new Map(weeklyRows.map((r) => [r.day, r.c]));
    const weekly: { date: string; label: string; count: number }[] = [];
    const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      weekly.push({ date: dayKey(d), label: DOW[d.getDay()] ?? "", count: weeklyMap.get(dayKey(d)) ?? 0 });
    }

    /* Student-course map (for course inactivity). */
    const classStudents = courseIds.length
      ? await db.select({ classId: schema.classStudents.classId, userId: schema.classStudents.userId }).from(schema.classStudents).where(inArray(schema.classStudents.classId, courseIds))
      : [];
    const studentsByCourse = new Map<string, string[]>();
    for (const r of classStudents) {
      const arr = studentsByCourse.get(r.classId) ?? [];
      arr.push(r.userId); studentsByCourse.set(r.classId, arr);
    }

    /* Alerts. */
    const inactiveStudents = students.filter((s) => (lastById.get(s.id) ?? 0) < since7.getTime()).length;
    const lowPrecisionStudents = perUserAcc.filter((r) => r.avg < 60).length;
    const inactiveTeachers = teachers.filter((t) => !t.lastLoginAt || new Date(t.lastLoginAt).getTime() < since14.getTime()).length;

    const attentionCourses: { id: string; name: string; reason: string }[] = [];
    for (const c of courses) {
      const roster = studentsByCourse.get(c.id) ?? [];
      const hasTeacher = (teacherCountById.get(c.id) ?? 0) > 0;
      const anyActive7d = roster.some((uid) => (lastById.get(uid) ?? 0) >= since7.getTime());
      const atRisk = roster.filter((uid) => (accById.get(uid) ?? 100) < 60).length;
      if (!hasTeacher) attentionCourses.push({ id: c.id, name: c.name, reason: "Sin docente asignado" });
      else if (roster.length > 0 && !anyActive7d) attentionCourses.push({ id: c.id, name: c.name, reason: "Sin actividad hace 7 días" });
      else if (atRisk >= 3) attentionCourses.push({ id: c.id, name: c.name, reason: `${atRisk} alumnos en riesgo` });
    }
    const coursesNoTeacher = courses.filter((c) => (teacherCountById.get(c.id) ?? 0) === 0).length;

    const recentActivity = recent.map((r) => ({
      studentName: nameById.get(r.userId) ?? "Alumno",
      worldId: r.worldId,
      completed: r.completed,
      at: new Date(r.endedAt).toISOString(),
    }));

    return reply.send({
      counts: { courses: courses.length, teachers: teachers.length, students: students.length },
      activeToday,
      avgProgress,
      weekly,
      alerts: { inactiveStudents, lowPrecisionStudents, inactiveTeachers, coursesNoTeacher },
      attentionCourses: attentionCourses.slice(0, 6),
      recent: recentActivity,
    });
  });
}
