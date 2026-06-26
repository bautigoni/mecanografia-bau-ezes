/* CSV bulk import — admins of a sede can upload a CSV of students /
 * teachers and the API will create them in batch.
 *
 * The CSV must have a header row:
 *   name,email,role,grade,class
 * - role: "alumno" | "profesor"   (admin-sede cannot import admin-sede)
 * - grade: opcional, default "libre"
 * - class: opcional, nombre de la clase (se crea si no existe)
 *
 * Endpoint: POST /api/import/users
 * Body: text/csv (small enough to fit in the Fastify body limit)
 *
 * Returns:
 *   { created: number, skipped: number, errors: Array<{row, message}> }
 *
 * Each created user is given a temporary password; the response includes
 * a per-row `temporaryPassword` so the admin can hand them out (or share
 * via the invitation link). */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { and, eq, sql } from "drizzle-orm";
import { verifyAccessToken, hashPassword } from "../auth.js";
import { assertCanGrant, canActOnSede, ForbiddenError } from "../rbac.js";

async function requireAdminOrAbove(req: FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  const claims = await verifyAccessToken(auth.slice("Bearer ".length));
  if (!["admin-sede", "admin-general", "superadmin"].includes(claims.role)) {
    throw Object.assign(new Error("Solo los administradores pueden importar usuarios."), { status: 403 });
  }
  return claims;
}

interface ParsedRow {
  name: string;
  email: string;
  role: "alumno" | "profesor";
  grade?: string;
  className?: string;
}

function parseCsv(text: string): { rows: ParsedRow[]; errors: Array<{ row: number; message: string }> } {
  const errors: Array<{ row: number; message: string }> = [];
  const rows: ParsedRow[] = [];
  // Lightweight parser: handles quoted fields with commas inside.
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (field.length || cur.length) { cur.push(field); lines.push(cur); cur = []; field = ""; }
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else field += ch;
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  if (!lines.length) return { rows, errors };

  // Header?
  const first = lines[0]!.map((s) => s.toLowerCase().trim());
  const hasHeader = first.includes("email") || first.includes("name");
  const data = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < data.length; i++) {
    const cells = data[i]!;
    if (!cells.some((c) => c.trim().length)) continue; // skip empty lines
    const [name, email, role, grade, className] = cells.map((c) => c.trim());
    if (!name || !email) {
      errors.push({ row: i + 1, message: "Faltan nombre o email." });
      continue;
    }
    if (!email.includes("@")) {
      errors.push({ row: i + 1, message: "Email inválido." });
      continue;
    }
    if (role && !["alumno", "profesor"].includes(role)) {
      errors.push({ row: i + 1, message: `Rol no permitido en CSV: ${role}.` });
      continue;
    }
    rows.push({ name, email, role: (role as "alumno" | "profesor") || "alumno", grade, className });
  }
  return { rows, errors };
}

function makeUsername(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 10);
  return base || `user${Date.now().toString().slice(-4)}`;
}

function makeTempPassword(): string {
  return `tmp-${Math.random().toString(36).slice(2, 8)}`;
}

export async function importRoutes(app: FastifyInstance) {
  app.post("/api/import/users", async (req, reply) => {
    const actor = await requireAdminOrAbove(req);
    const csv = (req.body ?? "").toString();
    if (!csv) return reply.code(400).send({ error: "El cuerpo de la solicitud está vacío." });

    const { rows, errors: parseErrors } = parseCsv(csv);
    if (!rows.length && parseErrors.length) {
      return reply.code(400).send({ error: "CSV sin filas válidas.", errors: parseErrors });
    }

    // Pre-flight RBAC: refuse roles the actor cannot grant.
    for (const r of rows) {
      try {
        assertCanGrant(actor.role as schema.Role, r.role);
      } catch (e) {
        if (e instanceof ForbiddenError) {
          return reply.code(403).send({ error: e.message });
        }
        throw e;
      }
    }

    const results: Array<{ row: number; ok: true; email: string; username: string; temporaryPassword: string } | { row: false; ok: false; email: string; message: string }> = [];
    let created = 0;
    let skipped = 0;
    const runErrors: Array<{ row: number; message: string }> = [...parseErrors];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      // Skip duplicates by email.
      const existing = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${r.email.toLowerCase()}`)
        .limit(1);
      if (existing[0]) {
        results.push({ row: false, ok: false, email: r.email, message: "Ya existe una cuenta con ese email." });
        skipped++;
        continue;
      }
      // Resolve / create class.
      let classId: string | null = null;
      if (r.className) {
        if (!actor.sede) {
          results.push({ row: false, ok: false, email: r.email, message: "No hay sede asociada a tu cuenta." });
          skipped++;
          continue;
        }
        const [existingClass] = await db
          .select()
          .from(schema.classes)
          .where(and(eq(schema.classes.sedeId, actor.sede), eq(schema.classes.name, r.className)))
          .limit(1);
        if (existingClass) classId = existingClass.id;
        else {
          const [created] = await db
            .insert(schema.classes)
            .values({
              sedeId: actor.sede,
              name: r.className,
              grade: (r.grade as schema.Grade | undefined) ?? "libre",
            })
            .returning();
          classId = created!.id;
        }
      }
      const tempPassword = makeTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const [row] = await db
        .insert(schema.users)
        .values({
          fullName: r.name,
          email: r.email.toLowerCase(),
          username: makeUsername(r.name),
          role: r.role,
          sedeId: actor.sede,
          classId,
          grade: (r.grade as schema.Grade | undefined) ?? "libre",
          passwordHash,
          mustChangePassword: true,
          temporaryPassword: true,
        })
        .returning();
      if (!row) {
        results.push({ row: false, ok: false, email: r.email, message: "No se pudo crear." });
        skipped++;
        continue;
      }
      if (classId) {
        if (r.role === "alumno") {
          await db.insert(schema.classStudents).values({ classId, userId: row.id }).onConflictDoNothing();
        } else {
          await db.insert(schema.classTeachers).values({ classId, userId: row.id }).onConflictDoNothing();
        }
      }
      results.push({ row: i + 1, ok: true, email: r.email, username: row.username!, temporaryPassword: tempPassword });
      created++;
    }
    return reply.send({ created, skipped, results, errors: runErrors });
  });
}
