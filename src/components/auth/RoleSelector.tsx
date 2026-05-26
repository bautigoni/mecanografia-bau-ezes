import { Building2, GraduationCap, ShieldCheck, UserRound } from "lucide-react";
import type { Role } from "../../types";
import { roleLabel } from "../../utils/storage";

const roleIcons = {
  "admin-general": ShieldCheck,
  "admin-sede": Building2,
  profesor: GraduationCap,
  alumno: UserRound,
};

const roles: Role[] = ["admin-general", "admin-sede", "profesor", "alumno"];

export function RoleSelector({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <>
      <div className="role-selector__label">
        <span aria-hidden="true">✦</span>
        <strong>Tu rol</strong>
        <span aria-hidden="true">✦</span>
      </div>
      <div className="role-selector" aria-label="Seleccionar rol">
        {roles.map((item) => {
          const Icon = roleIcons[item];

          return (
            <button
              key={item}
              type="button"
              className={item === role ? "role-selector__item is-active" : "role-selector__item"}
              onClick={() => onChange(item)}
            >
              <Icon size={21} strokeWidth={2.35} />
              <span>{roleLabel(item)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
