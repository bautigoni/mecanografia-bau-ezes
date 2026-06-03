/* One-shot seed: creates the superadmin, the two demo sedes, and the
 * superadmin's own sede binding. Idempotent — re-running is a no-op.
 *
 * Usage (from the api container, after the DB is up):
 *   node dist/seed.js
 * Or in dev:
 *   npx tsx src/seed.ts
 *
 * The seed prints the superadmin password to stdout. The default is
 * "admin" (matching the existing localStorage seed), so existing demos
 * keep working. CHANGE THIS IN PRODUCTION via SUPERADMIN_PASSWORD. */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcrypt";
import * as schema from "./db/schema.js";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL ?? "bautistagoni@northfield.edu.ar").toLowerCase();
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "admin";
const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME ?? "Bautista Goni";

async function main() {
  const sqlClient = postgres(DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sqlClient, { schema });

  console.log("seeding superadmin…");
  // Upsert a default sede so the superadmin has a binding.
  const existingSede = await db.select().from(schema.sedes).limit(1);
  let sedeId = existingSede[0]?.id;
  if (!sedeId) {
    const [sede] = await db
      .insert(schema.sedes)
      .values({ name: "Sede Principal", city: "Buenos Aires" })
      .returning();
    sedeId = sede!.id;
    console.log(`  + created sede ${sedeId}`);
  }

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  const existing = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${SUPERADMIN_EMAIL}`)
    .limit(1);
  if (existing[0]) {
    await db
      .update(schema.users)
      .set({ role: "superadmin", passwordHash, sedeId, fullName: SUPERADMIN_NAME, active: true })
      .where(sql`lower(${schema.users.email}) = ${SUPERADMIN_EMAIL}`);
    console.log(`  = updated existing user ${SUPERADMIN_EMAIL}`);
  } else {
    await db.insert(schema.users).values({
      email: SUPERADMIN_EMAIL,
      fullName: SUPERADMIN_NAME,
      username: "admin",
      role: "superadmin",
      passwordHash,
      sedeId,
      active: true,
    });
    console.log(`  + created superadmin ${SUPERADMIN_EMAIL}`);
  }

  console.log("seed complete.");
  console.log(`SUPERADMIN: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
  await sqlClient.end();
}

main().catch((err) => {
  console.error("seed failed", err);
  process.exit(1);
});
