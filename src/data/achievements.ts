/* Achievement display catalog (F5). Ids must match api/src/stats.ts. */
export interface AchievementMeta {
  label: string;
  emoji: string;
  desc: string;
}

export const ACHIEVEMENTS_META: Record<string, AchievementMeta> = {
  "primera-letra": { label: "Primera letra", emoji: "🔤", desc: "Completaste tu primer nivel" },
  "diez-niveles": { label: "10 niveles", emoji: "🔟", desc: "Completaste 10 niveles" },
  "cincuenta-niveles": { label: "50 niveles", emoji: "🏅", desc: "Completaste 50 niveles" },
  "cien-actividades": { label: "100 actividades", emoji: "💯", desc: "Jugaste 100 veces" },
  "racha-7": { label: "Racha de 7 días", emoji: "🔥", desc: "7 días seguidos" },
  "racha-30": { label: "Racha de 30 días", emoji: "🚀", desc: "30 días seguidos" },
  "perfeccionista": { label: "Perfeccionista", emoji: "⭐", desc: "100% de precisión" },
  "coleccionista": { label: "Coleccionista", emoji: "🌟", desc: "Juntaste 50 estrellas" },
};

export const ALL_ACHIEVEMENTS = Object.keys(ACHIEVEMENTS_META);

export function achievementMeta(id: string): AchievementMeta {
  return ACHIEVEMENTS_META[id] ?? { label: id, emoji: "🏆", desc: "" };
}
