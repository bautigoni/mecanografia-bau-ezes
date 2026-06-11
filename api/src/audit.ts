/* Centralised audit-log writer. Every privileged mutation should call
 * `audit()` so the trail is consistent (and we never accidentally skip
 * logging on the happy path).
 *
 * `meta` is JSON-encoded as a text column on purpose: cheap, no jsonb
 * migration, and the dashboard just JSON.parses on read. */

import { db, schema } from "./db/index.js";
import type { AccessClaims } from "./auth.js";

export interface AuditInput {
  actor: Pick<AccessClaims, "sub" | "role" | "sede"> | null;
  action: string; // e.g. "delete_user", "close_academic_year", "archive_class"
  entityType: "user" | "class" | "sede" | "invitation" | "academic_year" | "enrollment";
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      actorId: input.actor?.sub ?? null,
      sedeId: input.actor?.sede ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
  } catch {
    /* never fail the caller because of an audit write */
  }
}
