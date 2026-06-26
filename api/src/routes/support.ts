/* Soporte — acceso en MODO LECTURA a la cuenta de otra persona (F8).
 *
 *   POST /api/admin/impersonate   (superadmin / admin-general / admin-sede)
 *
 * Pensado para soporte/diagnóstico avalado legalmente: un administrador
 * puede VER la cuenta de un usuario de su alcance durante 30 minutos, sin
 * poder modificar nada. Requiere TRIPLE autenticación en la misma llamada:
 *   1) re-ingreso de la propia contraseña del administrador,
 *   2) frase de confirmación exacta ("ACCEDER EN MODO LECTURA"),
 *   3) aceptación explícita del aviso legal (legalAck === true).
 *
 * El token emitido es de SOLO LECTURA (claim readOnly) y NO trae refresh
 * cookie, así que muere solo a los 30 minutos y no se puede renovar. El
 * hook global en server.ts rechaza toda mutación hecha con ese token. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { verifyAccessToken, signAccessToken, comparePassword } from "../auth.js";
import { canActOnSede } from "../rbac.js";
import { audit } from "../audit.js";
import type { AccessClaims } from "../auth.js";

const READONLY_TTL_SECONDS = 30 * 60;
export const CONFIRM_PHRASE = "ACCEDER EN MODO LECTURA";

async function requireUser(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  return verifyAccessToken(auth.slice("Bearer ".length));
}

const schema_ = z.object({
  userId: z.string().uuid(),
  password: z.string().min(1),
  confirmPhrase: z.string(),
  legalAck: z.literal(true),
});

export async function supportRoutes(app: FastifyInstance) {
  app.post("/api/admin/impersonate", async (req, reply) => {
    const actor = await requireUser(req);
    // Una sesión de soporte (readOnly) jamás puede iniciar otra.
    if (actor.readOnly) return reply.code(403).send({ error: "Una sesión de lectura no puede iniciar otra." });
    if (actor.role !== "superadmin" && actor.role !== "admin-general" && actor.role !== "admin-sede") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const parsed = schema_.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Para entrar en modo lectura tenés que completar la triple verificación." });
    }
    const { userId, password, confirmPhrase } = parsed.data;

    // (2) Frase de confirmación exacta.
    if (confirmPhrase.trim() !== CONFIRM_PHRASE) {
      return reply.code(400).send({ error: `Escribí exactamente: ${CONFIRM_PHRASE}` });
    }

    // (1) Re-ingreso de la contraseña del propio administrador.
    const [me] = await db.select().from(schema.users).where(eq(schema.users.id, actor.sub)).limit(1);
    if (!me || !me.passwordHash) {
      return reply.code(403).send({ error: "Tu cuenta no tiene contraseña local; no se puede verificar." });
    }
    const ok = await comparePassword(password, me.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Contraseña incorrecta." });

    // Objetivo + alcance.
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!target || target.deletedAt) return reply.code(404).send({ error: "Usuario no encontrado." });
    if (target.id === actor.sub) return reply.code(400).send({ error: "Esa ya es tu propia cuenta." });
    // Nadie entra a un superadmin; solo un superadmin puede entrar a un admin-general.
    if (target.role === "superadmin") return reply.code(403).send({ error: "No se puede acceder a una cuenta superadmin." });
    if (target.role === "admin-general" && actor.role !== "superadmin") {
      return reply.code(403).send({ error: "No autorizado para esta cuenta." });
    }
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, target.sedeId)) {
      return reply.code(403).send({ error: "La cuenta es de otra sede." });
    }

    const access = await signAccessToken(
      {
        sub: target.id,
        role: target.role,
        sede: target.sedeId,
        email: target.email,
        name: target.fullName,
        readOnly: true,
        act: { sub: actor.sub, name: actor.name, role: actor.role },
      },
      READONLY_TTL_SECONDS,
    );

    await audit({
      actor,
      action: "impersonate_start",
      entityType: "user",
      entityId: target.id,
      meta: { targetEmail: target.email, targetRole: target.role, mode: "read-only", ttlSeconds: READONLY_TTL_SECONDS },
    });

    return reply.send({
      access,
      expiresInSeconds: READONLY_TTL_SECONDS,
      actor: { name: actor.name },
      user: {
        id: target.id,
        email: target.email,
        name: target.fullName,
        username: target.username,
        role: target.role,
        sedeId: target.sedeId,
        classId: target.classId,
        mustChangePassword: false,
      },
    });
  });
}
