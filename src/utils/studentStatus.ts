import type { EduTicUser } from "../types";

/* Derives a coarse status for a student from the stats we actually have in
   localStorage (precision / completedLevels). Real per-attempt history would
   need the backend; this is the honest "lo disponible" classification. */
export type StudentStatus = "flying" | "atRisk" | "idle" | "neutral";

export function studentStatus(user: EduTicUser): StudentStatus {
  const s = user.stats;
  if (!s || s.completedLevels === 0) return "idle";
  if (s.precision >= 85) return "flying";
  if (s.precision > 0 && s.precision < 60) return "atRisk";
  return "neutral";
}

export const STATUS_LABEL: Record<StudentStatus, string> = {
  flying: "Va volando",
  atRisk: "Necesita ayuda",
  idle: "Sin actividad",
  neutral: "En curso",
};
