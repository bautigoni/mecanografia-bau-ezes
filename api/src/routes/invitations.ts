/* Invitations — create (+ email via Resend), list, public lookup, and
 * accept. Moves invitations off the per-device localStorage path and into
 * the database so an invite created on one machine can be accepted on any
 * other, end to end.
 *
 *   POST   /api/invitations                 (admin-sede+ )  create + email
 *   GET    /api/invitations                 (admin-sede+ )  list (scoped)
 *   GET    /api/invitations/by-token/:token (public)        who/what
 *   POST   /api/invitations/:token/accept   (public)        set pw → login
 *
 * The raw token is only ever in the email link; the DB stores its SHA-256
 * hash (schema.invitations.tokenHash). Acceptance creates/activates the
 * user with the invited role and auto-logs them in (same cookie/access
 * contract as /api/auth/login). */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  hashPassword,
  hashToken,
  newOpaqueToken,
  signAccessToken,
  issueRefreshToken,
  verifyAccessToken,
} from "../auth.js";
import type { AccessClaims } from "../auth.js";
import { assertCanGrant, canActOnSede, ForbiddenError } from "../rbac.js";
import { audit } from "../audit.js";

const REFRESH_COOKIE = "typely_refresh";
const INVITE_TTL_DAYS = 14;

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
    maxAge: 30 * 24 * 60 * 60,
  });
}

async function requireAuth(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

function inviteLink(req: FastifyRequest, token: string): string {
  const origin =
    process.env.PUBLIC_ORIGIN?.trim() ||
    `https://${(req.headers["x-forwarded-host"] as string) || req.headers.host || "typely.bauhub.online"}`;
  return `${origin.replace(/\/$/, "")}/invite/${token}`;
}

/** Strip angle brackets so admin-entered fields can't inject markup. */
function safeText(value: string | null | undefined, fallback = ""): string {
  return value ? String(value).replace(/[<>]/g, "") : fallback;
}

async function sendInviteEmail(
  to: string,
  name: string | null,
  role: string,
  link: string,
  sedeName?: string | null,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.INVITE_FROM || "Typely <no-reply@typely.bauhub.online>";
  const safeName = safeText(name);
  const safeRole = role === "admin-sede" ? "administrador de sede" : "docente";
  const safeSchool = safeText(sedeName);
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#eef3ff;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Aceptá tu invitación y empezá a enseñar entre las nubes ✨</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3ff;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(54,86,134,0.18);font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="background:linear-gradient(135deg,#54e8c6,#25c8df,#536bff);padding:30px 24px;text-align:center;">
          <div style="font-size:30px;font-weight:800;letter-spacing:1px;color:#ffffff;">TYPELY ✨</div>
          <div style="color:rgba(255,255,255,0.92);font-size:14px;margin-top:6px;">Aprendé a escribir jugando entre las nubes</div>
        </td></tr>
        <tr><td style="padding:32px 30px 6px;">
          <h1 style="margin:0 0 10px;font-size:22px;color:#17355f;">¡Hola${safeName ? " " + safeName : ""}! 👋</h1>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#4a5891;">Te invitaron a <strong>Typely</strong> como <strong>${safeRole}</strong>${safeSchool ? ` en <strong>${safeSchool}</strong>` : ""}. Aceptá tu invitación y empezá a acompañar a tus alumnos en su aventura.</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 30px 6px;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#54e8c6,#25c8df,#536bff);color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 40px;border-radius:999px;box-shadow:0 10px 22px rgba(83,107,255,0.35);">Acceder a Typely&nbsp;→</a>
        </td></tr>
        <tr><td style="padding:18px 30px 26px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8a93b3;text-align:center;">¿No funciona el botón? Copiá y pegá este enlace:<br><a href="${link}" style="color:#536bff;word-break:break-all;">${link}</a></p>
        </td></tr>
        <tr><td style="background:#f6f8ff;padding:16px 24px;text-align:center;border-top:1px solid #e6ebf7;">
          <div style="font-size:11px;color:#9aa3c0;">Entorno seguro para aprender y enseñar · TYPELY</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: "✨ Te invitaron a TYPELY", html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().optional(),
  role: z.enum(["admin-sede", "profesor"]).default("profesor"),
  sedeId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
});

const acceptSchema = z.object({
  password: z.string().min(6),
});

export async function invitationRoutes(app: FastifyInstance) {
  /* ----- POST /api/invitations ----- */
  app.post("/api/invitations", async (req, reply) => {
    const actor = await requireAuth(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const data = parsed.data;

    assertCanGrant(actor.role, data.role);
    const sedeId = actor.role === "admin-sede" ? actor.sede : data.sedeId ?? actor.sede;
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, sedeId ?? null)) {
      throw new ForbiddenError("No podés invitar fuera de tu sede.");
    }

    // Consistencia: si el email ya pertenece a una cuenta con rol IGUAL o
    // SUPERIOR, la invitación no tiene sentido (al aceptarla no cambiaría
    // nada — o quedaría "accepted" sin que aparezca ningún admin nuevo, como
    // pasó al invitar el email del propio superadmin). Mensaje claro y 409.
    const [existingUser] = await db
      .select({ role: schema.users.role, fullName: schema.users.fullName })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${data.email}`)
      .limit(1);
    if (existingUser && (existingUser.role === "superadmin" || existingUser.role === "admin-general")) {
      return reply.code(409).send({
        error: `Ese email ya pertenece a ${existingUser.fullName} (${existingUser.role}). No hace falta invitarlo.`,
      });
    }
    if (existingUser && existingUser.role === data.role) {
      return reply.code(409).send({
        error: "Ese email ya tiene una cuenta con ese rol. Editá la cuenta existente en lugar de invitarla de nuevo.",
      });
    }

    const rawToken = newOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(schema.invitations)
      .values({
        email: data.email,
        name: data.name ?? null,
        role: data.role,
        sedeId: sedeId ?? null,
        classId: data.classId ?? null,
        tokenHash: hashToken(rawToken),
        status: "pending",
        invitedBy: actor.sub,
        expiresAt,
      })
      .returning();

    const link = inviteLink(req, rawToken);
    let sedeName: string | null = null;
    if (sedeId) {
      const [sede] = await db.select().from(schema.sedes).where(eq(schema.sedes.id, sedeId)).limit(1);
      sedeName = sede?.name ?? null;
    }
    const emailed = await sendInviteEmail(data.email, data.name ?? null, data.role, link, sedeName);
    if (emailed) {
      await db.update(schema.invitations).set({ status: "sent", sentAt: new Date() }).where(eq(schema.invitations.id, row!.id));
    }
    await audit({
      actor,
      action: "create_invitation",
      entityType: "invitation",
      entityId: row!.id,
      meta: { email: data.email, role: data.role, sedeId, emailed },
    });

    return reply.send({
      invitation: {
        id: row!.id,
        email: row!.email,
        name: row!.name,
        role: row!.role,
        status: emailed ? "sent" : "pending",
        createdAt: row!.createdAt,
      },
      emailed,
      link,
    });
  });

  /* ----- GET /api/invitations ----- */
  app.get("/api/invitations", async (req, reply) => {
    const actor = await requireAuth(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const where =
      actor.role === "superadmin" || actor.role === "admin-general"
        ? undefined
        : eq(schema.invitations.sedeId, actor.sede ?? "");
    const rows = await db
      .select({
        id: schema.invitations.id,
        email: schema.invitations.email,
        name: schema.invitations.name,
        role: schema.invitations.role,
        status: schema.invitations.status,
        sedeId: schema.invitations.sedeId,
        createdAt: schema.invitations.createdAt,
      })
      .from(schema.invitations)
      .where(where)
      .orderBy(desc(schema.invitations.createdAt));
    return reply.send(rows);
  });

  /* ----- DELETE /api/invitations/:id (F6: expire a single invitation) ----- */
  app.delete("/api/invitations/:id", async (req, reply) => {
    const actor = await requireAuth(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { id } = req.params as { id: string };
    const [inv] = await db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).limit(1);
    if (!inv) return reply.code(404).send({ error: "Invitación no encontrada." });
    if (actor.role === "admin-sede" && inv.sedeId !== actor.sede) {
      return reply.code(403).send({ error: "La invitación es de otra sede." });
    }
    if (inv.status === "accepted") {
      return reply.code(409).send({ error: "La invitación ya fue aceptada." });
    }
    await db
      .update(schema.invitations)
      .set({ status: "expired", expiresAt: new Date() })
      .where(eq(schema.invitations.id, id));
    await audit({
      actor,
      action: "expire_invitation",
      entityType: "invitation",
      entityId: id,
      meta: { email: inv.email, role: inv.role },
    });
    return reply.send({ ok: true });
  });

  /* ----- POST /api/invitations/expire-all (F6: bulk-expire every pending) ----- */
  app.post("/api/invitations/expire-all", async (req, reply) => {
    const actor = await requireAuth(req);
    if (actor.role === "profesor" || actor.role === "alumno") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const conditions: any[] = [eq(schema.invitations.status, "pending")];
    if (actor.role === "admin-sede") {
      if (!actor.sede) return reply.send({ expired: 0 });
      conditions.push(eq(schema.invitations.sedeId, actor.sede));
    }
    const pending = await db
      .select({ id: schema.invitations.id, email: schema.invitations.email })
      .from(schema.invitations)
      .where(and(...conditions));
    if (!pending.length) return reply.send({ expired: 0 });
    await db
      .update(schema.invitations)
      .set({ status: "expired", expiresAt: new Date() })
      .where(inArray(schema.invitations.id, pending.map((p) => p.id)));
    await audit({
      actor,
      action: "expire_all_invitations",
      entityType: "invitation",
      meta: { count: pending.length, emails: pending.map((p) => p.email) },
    });
    return reply.send({ expired: pending.length });
  });

  /* ----- GET /api/invitations/by-token/:token (public) ----- */
  app.get("/api/invitations/by-token/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const [inv] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, hashToken(token)))
      .limit(1);
    if (!inv) return reply.code(404).send({ error: "Invitación no encontrada." });
    let sedeName: string | undefined;
    if (inv.sedeId) {
      const [sede] = await db.select().from(schema.sedes).where(eq(schema.sedes.id, inv.sedeId)).limit(1);
      sedeName = sede?.name;
    }
    const expired = inv.expiresAt ? inv.expiresAt.getTime() < Date.now() : false;
    return reply.send({
      invitation: {
        email: inv.email,
        name: inv.name,
        role: inv.role,
        status: expired ? "expired" : inv.status,
        sedeName,
      },
    });
  });

  /* ----- POST /api/invitations/:token/accept (public) ----- */
  app.post("/api/invitations/:token/accept", async (req, reply) => {
    const { token } = req.params as { token: string };
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "La contraseña debe tener al menos 6 caracteres." });

    const [inv] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, hashToken(token)))
      .limit(1);
    if (!inv) return reply.code(404).send({ error: "Invitación no encontrada." });
    if (inv.status === "accepted") return reply.code(409).send({ error: "La invitación ya fue aceptada. Iniciá sesión." });
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
      return reply.code(410).send({ error: "La invitación expiró. Pedí una nueva." });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const email = inv.email.toLowerCase();

    // Reuse an existing account with this email, otherwise create one.
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${email}`)
      .limit(1);

    let user;
    if (existing && (existing.role === "superadmin" || existing.role === "admin-general")) {
      // Nunca degradar una cuenta de mayor privilegio aceptando una
      // invitación de rol inferior (un admin-sede podría "invitar" el email
      // del superadmin y pisarle rol y contraseña).
      return reply.code(409).send({ error: "Ese email ya tiene una cuenta con un rol superior. Iniciá sesión directamente." });
    }
    if (existing) {
      [user] = await db
        .update(schema.users)
        .set({
          passwordHash,
          role: inv.role,
          sedeId: inv.sedeId,
          classId: inv.classId ?? existing.classId,
          active: true,
          mustChangePassword: false,
          temporaryPassword: false,
        })
        .where(eq(schema.users.id, existing.id))
        .returning();
    } else {
      [user] = await db
        .insert(schema.users)
        .values({
          role: inv.role,
          email,
          passwordHash,
          fullName: inv.name ?? inv.email.split("@")[0]!,
          sedeId: inv.sedeId,
          classId: inv.classId,
          active: true,
        })
        .returning();
    }

    // Link to the class roster when the invite targeted one.
    if (inv.classId && user!.role === "profesor") {
      await db
        .insert(schema.classTeachers)
        .values({ classId: inv.classId, userId: user!.id })
        .onConflictDoNothing();
    }

    await db
      .update(schema.invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(schema.invitations.id, inv.id));

    const access = await signAccessToken({
      sub: user!.id,
      role: user!.role,
      sede: user!.sedeId,
      email: user!.email,
      name: user!.fullName,
    });
    const { token: refresh } = await issueRefreshToken(user!.id);
    setRefreshCookie(reply, refresh);
    return reply.send({
      access,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.fullName,
        username: user!.username,
        role: user!.role,
        sedeId: user!.sedeId,
        classId: user!.classId,
        mustChangePassword: false,
      },
    });
  });
}
