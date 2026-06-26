/* Users routes — list, create, edit, delete, reset password.
 *
 * Role-based:
 *   - superadmin: all users, all roles
 *   - admin-general: all users, but cannot create admin-general/superadmin
 *   - admin-sede: only users in their own sede; can only create profesor/alumno
 *   - profesor: read-only on students in their classes
 *
 * Hard rule: an admin_sede can NEVER create another admin_sede. Enforced
 * via assertCanGrant() from rbac.ts. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, isNull, sql } from "drizzle-orm";
import { verifyAccessToken, hashPassword } from "../auth.js";
import { assertCanGrant, canActOnSede, ForbiddenError } from "../rbac.js";
import { audit } from "../audit.js";
import type { AccessClaims } from "../auth.js";

async function requireUser(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Sin sesión."), { status: 401 });
  }
  return verifyAccessToken(auth.slice("Bearer ".length));
}

const createUserSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(1).optional(),
  // When provided, the account is created with this exact password (no
  // forced change). When omitted, a temporary password is generated and
  // returned once. Lets the superadmin set user+password directly.
  password: z.string().min(6).optional(),
  role: z.enum(["superadmin", "admin-general", "admin-sede", "profesor", "alumno"]),
  sedeId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  grade: z.enum(["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"]).optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ role: true }).extend({
  active: z.boolean().optional(),
});

function makeUsername(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 10);
  return base || `user${Date.now().toString().slice(-4)}`;
}

function makeTempPassword(): string {
  return `tmp-${Math.random().toString(36).slice(2, 8)}`;
}

export async function userRoutes(app: FastifyInstance) {
  /* ----- GET /api/users?role=&sedeId=&includeDeleted= ----- */
  app.get("/api/users", async (req, reply) => {
    const actor = await requireUser(req);
    // Solo superficies de administración listan usuarios. Un token de alumno
    // o profesor no puede enumerar emails/usuarios de toda la plataforma
    // (los profesores tienen /api/teacher/students para su propio alcance).
    if (actor.role === "alumno" || actor.role === "profesor") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { role, sedeId, includeDeleted } = req.query as { role?: string; sedeId?: string; includeDeleted?: string };
    const conditions = [];
    if (role) conditions.push(eq(schema.users.role, role as schema.Role));
    // admin_sede can only see their own sede
    if (actor.role === "admin-sede") {
      if (actor.sede) conditions.push(eq(schema.users.sedeId, actor.sede));
      else conditions.push(sql`false`); // admin_sede without sede binding → no results
    } else if (sedeId) {
      conditions.push(eq(schema.users.sedeId, sedeId));
    }
    // F6: by default we hide soft-deleted accounts (Borrar cuenta from
    // the superadmin panel). Superadmin can opt in via ?includeDeleted=1.
    if (!includeDeleted) conditions.push(isNull(schema.users.deletedAt));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        username: schema.users.username,
        role: schema.users.role,
        sedeId: schema.users.sedeId,
        classId: schema.users.classId,
        grade: schema.users.grade,
        active: schema.users.active,
        mustChangePassword: schema.users.mustChangePassword,
        lastLoginAt: schema.users.lastLoginAt,
        deletedAt: schema.users.deletedAt,
      })
      .from(schema.users)
      .where(where as any)
      .orderBy(schema.users.fullName);
    return reply.send(rows);
  });

  /* ----- POST /api/users ----- */
  app.post("/api/users", async (req, reply) => {
    const actor = await requireUser(req);
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos.", details: parsed.error.flatten() });
    const data = parsed.data;
    try {
      assertCanGrant(actor.role as schema.Role, data.role);
    } catch (e) {
      if (e instanceof ForbiddenError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    // An admin-sede always creates within their OWN sede — never trust/require
    // a client-sent sedeId for them. Superadmin/admin-general may target any.
    const targetSede = actor.role === "admin-sede" ? (actor.sede ?? null) : (data.sedeId ?? null);
    if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, targetSede)) {
      return reply.code(403).send({ error: "No podés crear usuarios en otra sede." });
    }
    const chosen = !!data.password;
    const effectivePassword = data.password ?? makeTempPassword();
    const passwordHash = await hashPassword(effectivePassword);
    let row;
    try {
      [row] = await db
        .insert(schema.users)
        .values({
          fullName: data.fullName,
          email: data.email,
          username: data.username ?? makeUsername(data.fullName),
          role: data.role,
          sedeId: targetSede,
          classId: data.classId ?? null,
          grade: data.grade ?? "libre",
          passwordHash,
          mustChangePassword: !chosen,
          temporaryPassword: !chosen,
        })
        .returning();
    } catch (e: any) {
      // Unique violation on email/username → friendly message.
      if (e?.code === "23505") return reply.code(409).send({ error: "Ya existe un usuario con ese email o usuario." });
      throw e;
    }
    if (!row) return reply.code(500).send({ error: "No se pudo crear el usuario." });
    if (data.classId) {
      if (data.role === "alumno") {
        await db.insert(schema.classStudents).values({ classId: data.classId, userId: row.id }).onConflictDoNothing();
      } else if (data.role === "profesor") {
        await db.insert(schema.classTeachers).values({ classId: data.classId, userId: row.id }).onConflictDoNothing();
      }
    }
    await audit({
      actor,
      action: "create_user",
      entityType: "user",
      entityId: row.id,
      meta: { role: data.role, email: data.email, sedeId: targetSede, classId: data.classId ?? null, generatedPassword: !chosen },
    });
    return reply.send({
      user: { id: row.id, email: row.email, name: row.fullName, username: row.username, role: row.role, sedeId: row.sedeId, classId: row.classId },
      // Only surface a password when WE generated it; a chosen one is not echoed.
      temporaryPassword: chosen ? null : effectivePassword,
    });
  });

  /* ----- PATCH /api/users/:id ----- */
  app.patch("/api/users/:id", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) return reply.code(404).send({ error: "Usuario no encontrado." });
    if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "No podés modificar usuarios de otra sede." });
    }
    // El destino del cambio de sede también tiene que estar dentro del
    // alcance del actor (un admin-sede no puede mover usuarios a otra sede).
    if (
      parsed.data.sedeId !== undefined &&
      !canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, parsed.data.sedeId ?? null)
    ) {
      return reply.code(403).send({ error: "No podés mover usuarios a otra sede." });
    }
    if (target.role === "superadmin" && actor.role !== "superadmin") {
      return reply.code(403).send({ error: "Solo el superadmin puede modificar al superadmin." });
    }
    // El curso destino también tiene que ser de una sede sobre la que el
    // actor puede actuar.
    if (parsed.data.classId) {
      const [cls] = await db.select().from(schema.classes).where(eq(schema.classes.id, parsed.data.classId)).limit(1);
      if (!cls) return reply.code(400).send({ error: "El curso no existe." });
      if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, cls.sedeId)) {
        return reply.code(403).send({ error: "El curso es de otra sede." });
      }
    }
    let row;
    try {
      [row] = await db
        .update(schema.users)
        .set({
          fullName: parsed.data.fullName ?? target.fullName,
          email: parsed.data.email ?? target.email,
          username: parsed.data.username ?? target.username,
          sedeId: parsed.data.sedeId !== undefined ? parsed.data.sedeId : target.sedeId,
          classId: parsed.data.classId !== undefined ? parsed.data.classId : target.classId,
          grade: parsed.data.grade ?? target.grade,
          active: parsed.data.active !== undefined ? parsed.data.active : target.active,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id))
        .returning();
    } catch (e: any) {
      if (e?.code === "23505") return reply.code(409).send({ error: "Ya existe un usuario con ese email o usuario." });
      throw e;
    }
    // Mantener el roster (class_students) en sincronía cuando se cambia el
    // curso de un alumno desde la edición — igual que POST /classes/:id/students.
    if (target.role === "alumno" && parsed.data.classId !== undefined && parsed.data.classId !== target.classId) {
      await db.delete(schema.classStudents).where(eq(schema.classStudents.userId, id));
      if (parsed.data.classId) {
        await db.insert(schema.classStudents).values({ classId: parsed.data.classId, userId: id }).onConflictDoNothing();
      }
    }
    return reply.send(row);
  });

  /* ----- DELETE /api/users/:id (F6: soft delete) ----- */
  app.delete("/api/users/:id", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) return reply.code(404).send({ error: "Usuario no encontrado." });
    if (target.role === "superadmin") {
      return reply.code(403).send({ error: "El superadmin no se puede eliminar." });
    }
    try {
      assertCanGrant(actor.role as schema.Role, target.role);
    } catch (e) {
      if (e instanceof ForbiddenError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "No podés eliminar usuarios de otra sede." });
    }
    // F6: soft delete — keeps progress, attempts and audit history intact.
    // The account can no longer log in, is hidden from listings, and is
    // excluded from class rosters via the active=true filter (also flipped
    // to false so any in-flight session sees "user inactive" on next call).
    await db
      .update(schema.users)
      .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
      .where(eq(schema.users.id, id));
    await audit({
      actor,
      action: "delete_user",
      entityType: "user",
      entityId: id,
      meta: { email: target.email, role: target.role },
    });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/users/:id/restore (F6: re-activate a soft-deleted account) ----- */
  app.post("/api/users/:id/restore", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) return reply.code(404).send({ error: "Usuario no encontrado." });
    try {
      assertCanGrant(actor.role as schema.Role, target.role);
    } catch (e) {
      if (e instanceof ForbiddenError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "No podés restaurar usuarios de otra sede." });
    }
    await db
      .update(schema.users)
      .set({ deletedAt: null, active: true, updatedAt: new Date() })
      .where(eq(schema.users.id, id));
    await audit({
      actor,
      action: "restore_user",
      entityType: "user",
      entityId: id,
      meta: { email: target.email, role: target.role },
    });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/users/:id/reset-password ----- */
  app.post("/api/users/:id/reset-password", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) return reply.code(404).send({ error: "Usuario no encontrado." });
    try {
      assertCanGrant(actor.role as schema.Role, target.role);
    } catch (e) {
      if (e instanceof ForbiddenError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    if (!canActOnSede({ role: actor.role as schema.Role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "No podés resetear la contraseña de usuarios de otra sede." });
    }
    const tempPassword = makeTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await db
      .update(schema.users)
      .set({ passwordHash, mustChangePassword: true, temporaryPassword: true })
      .where(eq(schema.users.id, id));
    await audit({
      actor,
      action: "reset_password",
      entityType: "user",
      entityId: id,
      meta: { email: target.email, role: target.role },
    });
    return reply.send({ temporaryPassword: tempPassword });
  });

  /* ----- POST /api/users/:id/change-password (self-service) ----- */
  app.post("/api/users/:id/change-password", async (req, reply) => {
    const actor = await requireUser(req);
    const { id } = req.params as { id: string };
    if (actor.sub !== id) {
      return reply.code(403).send({ error: "Solo podés cambiar tu propia contraseña." });
    }
    // Mínimo 6 — consistente con la creación de usuarios, la aceptación de
    // invitaciones y el formulario "Cambiar contraseña" del frontend.
    const body = z.object({ newPassword: z.string().min(6) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "La contraseña nueva debe tener al menos 6 caracteres." });
    const passwordHash = await hashPassword(body.data.newPassword);
    await db
      .update(schema.users)
      .set({ passwordHash, mustChangePassword: false, temporaryPassword: false })
      .where(eq(schema.users.id, id));
    return reply.send({ ok: true });
  });
}
