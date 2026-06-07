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
import { eq, and, desc, sql } from "drizzle-orm";
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

async function sendInviteEmail(to: string, name: string | null, role: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.INVITE_FROM || "Typely <no-reply@typely.bauhub.online>";
  const roleLabel = role === "admin-sede" ? "administrador de sede" : "docente";
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#17355f">
      <h2>¡Hola${name ? ` ${name}` : ""}!</h2>
      <p>Te invitaron a Typely como <b>${roleLabel}</b>.</p>
      <p><a href="${link}" style="background:#6f63ff;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Aceptar invitación</a></p>
      <p style="color:#61709e;font-size:13px">O copiá este enlace: ${link}</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: "Te invitaron a Typely ✨", html }),
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
    const emailed = await sendInviteEmail(data.email, data.name ?? null, data.role, link);
    if (emailed) {
      await db.update(schema.invitations).set({ status: "sent", sentAt: new Date() }).where(eq(schema.invitations.id, row!.id));
    }

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
