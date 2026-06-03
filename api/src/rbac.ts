/* Role-based access control — the single chokepoint for every privileged
   operation. The frontend's role checks are convenience; THIS module is
   the only one that can authorise.

   Hard rule: an `admin_sede` can NEVER create or modify another
   `admin_sede` or any `superadmin`. They manage their own sede's
   profesores and alumnos only. Enforced by `canGrantRole` and called
   from every user-mutating route. */
import type { Role } from "./db/schema.js";

/* The role hierarchy is implicit — there are no super-powers gained by
   a "higher" role, only additional surfaces. The interesting check is
   "can X grant role Y?". */
const ROLE_RANK: Record<Role, number> = {
  alumno: 1,
  profesor: 2,
  "admin-sede": 3,
  "admin-general": 4,
  superadmin: 5,
};

/** Returns the most-privileged role an actor may grant. Anyone at or
 *  below this rank is OK; anyone above is forbidden. The superadmin is
 *  the only role that can create another superadmin, and an `admin_sede`
 *  can never create another `admin_sede`. */
export function maxGranteableRole(actor: Role): Role {
  if (actor === "superadmin") return "superadmin";
  if (actor === "admin-general") return "admin-general";
  if (actor === "admin-sede") return "profesor"; // alumno + profesor only
  if (actor === "profesor") return "alumno";
  return "alumno";
}

export function canGrantRole(actor: Role, target: Role): boolean {
  return ROLE_RANK[target] <= ROLE_RANK[maxGranteableRole(actor)];
}

export function canActOnSede(actor: { role: Role; sedeId: string | null }, targetSedeId: string | null): boolean {
  if (actor.role === "superadmin" || actor.role === "admin-general") return true;
  if (actor.role === "admin-sede") return actor.sedeId === targetSedeId;
  return false;
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCanGrant(actor: Role, target: Role): void {
  if (!canGrantRole(actor, target)) {
    throw new ForbiddenError(
      `Tu rol (${actor}) no puede crear ni modificar cuentas con rol ${target}.`,
    );
  }
}
