/* Sedes routes — only the superadmin can list / create / edit / delete.
 * Admin_sede and below are blocked. */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";

async function requireSuperadmin(req: FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  const claims = await verifyAccessToken(auth.slice("Bearer ".length));
  if (claims.role !== "superadmin") throw Object.assign(new Error("Solo el superadmin puede gestionar sedes."), { status: 403 });
  return claims;
}

const sedeSchema = z.object({
  name: z.string().trim().min(1),
  city: z.string().trim().optional(),
  photo: z.string().optional(),
  active: z.boolean().optional(),
});

export async function sedeRoutes(app: FastifyInstance) {
  app.get("/api/sedes", async (req) => {
    await requireSuperadmin(req);
    return db.select().from(schema.sedes).orderBy(schema.sedes.name);
  });

  /* The signed-in user's own sede (any authenticated role). The sede-admin
   * dashboard uses this for its header — it cannot call the superadmin-only
   * /api/sedes list. */
  app.get("/api/sedes/mine", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Sin sesión." });
    const claims = await verifyAccessToken(auth.slice("Bearer ".length));
    if (!claims.sede) return reply.code(404).send({ error: "Sin sede asignada." });
    const [row] = await db.select().from(schema.sedes).where(eq(schema.sedes.id, claims.sede)).limit(1);
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    return reply.send(row);
  });

  app.post("/api/sedes", async (req, reply) => {
    await requireSuperadmin(req);
    const parsed = sedeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const [row] = await db.insert(schema.sedes).values(parsed.data).returning();
    return reply.send(row);
  });

  app.patch("/api/sedes/:id", async (req, reply) => {
    await requireSuperadmin(req);
    const { id } = req.params as { id: string };
    const parsed = sedeSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos." });
    const [row] = await db.update(schema.sedes).set(parsed.data).where(eq(schema.sedes.id, id)).returning();
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    return reply.send(row);
  });

  app.delete("/api/sedes/:id", async (req, reply) => {
    await requireSuperadmin(req);
    const { id } = req.params as { id: string };
    const [row] = await db.delete(schema.sedes).where(eq(schema.sedes.id, id)).returning();
    if (!row) return reply.code(404).send({ error: "Sede no encontrada." });
    return reply.send({ ok: true });
  });
}
