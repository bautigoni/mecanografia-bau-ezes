/* Single Postgres connection pool shared by every route. Drizzle's
   postgres-js driver returns a tagged-template query builder; we wrap it
   with drizzle() to get typed queries against `schema.ts`. */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (set via Docker secret or env).");
}

/* Conservative pool for a 1 GB VPS. Postgres-js multiplexes so the
   effective concurrency is roughly `max * 4`. */
const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false, // pgBouncer compatibility
});

export const db = drizzle(sql, { schema });
export { schema };
export type Db = typeof db;
