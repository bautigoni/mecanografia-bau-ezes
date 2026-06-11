/* Gamification stats (F5): compute XP / stars / streak / achievements from
 * the raw level_progress + attempts, persist into student_stats, and unlock
 * achievements. Shared by the progress-complete write and the read endpoints. */

import { db, schema } from "./db/index.js";
import { eq, sql } from "drizzle-orm";

export interface ComputedStats {
  levelsCompleted: number;
  stars: number;
  xp: number;
  streakDays: number;
  longestStreak: number;
  totalAttempts: number;
  avgAccuracy: number;
  maxAccuracy: number;
  lastActiveDay: string | null;
}

/** Static achievement catalog. Evaluated against ComputedStats. */
export const ACHIEVEMENTS: { id: string; test: (s: ComputedStats) => boolean }[] = [
  { id: "primera-letra", test: (s) => s.levelsCompleted >= 1 },
  { id: "diez-niveles", test: (s) => s.levelsCompleted >= 10 },
  { id: "cincuenta-niveles", test: (s) => s.levelsCompleted >= 50 },
  { id: "cien-actividades", test: (s) => s.totalAttempts >= 100 },
  { id: "racha-7", test: (s) => s.streakDays >= 7 },
  { id: "racha-30", test: (s) => s.streakDays >= 30 },
  { id: "perfeccionista", test: (s) => s.maxAccuracy >= 100 },
  { id: "coleccionista", test: (s) => s.stars >= 50 },
];

export async function computeStats(userId: string): Promise<ComputedStats> {
  const lp = await db
    .select({ completed: schema.levelProgress.completed, bestAccuracy: schema.levelProgress.bestAccuracy })
    .from(schema.levelProgress)
    .where(eq(schema.levelProgress.userId, userId));
  const att = await db
    .select({ endedAt: schema.attempts.endedAt })
    .from(schema.attempts)
    .where(eq(schema.attempts.userId, userId));

  let levelsCompleted = 0, stars = 0, accSum = 0, maxAccuracy = 0;
  for (const r of lp) {
    accSum += r.bestAccuracy;
    if (r.bestAccuracy > maxAccuracy) maxAccuracy = r.bestAccuracy;
    if (r.completed) { levelsCompleted++; stars += r.bestAccuracy >= 90 ? 3 : r.bestAccuracy >= 75 ? 2 : 1; }
  }
  const avgAccuracy = lp.length ? Math.round(accSum / lp.length) : 0;
  const xp = levelsCompleted * 10 + (avgAccuracy >= 90 ? levelsCompleted * 2 : 0);

  // Streak from distinct attempt days, anchored today or yesterday.
  const dayset = new Set<string>();
  for (const a of att) dayset.add(new Date(a.endedAt).toISOString().slice(0, 10));
  let streakDays = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const lastActiveDay = att.length ? [...dayset].sort().at(-1) ?? null : null;
  if (!dayset.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dayset.has(d.toISOString().slice(0, 10))) { streakDays++; d.setDate(d.getDate() - 1); }

  return { levelsCompleted, stars, xp, streakDays, longestStreak: streakDays, totalAttempts: att.length, avgAccuracy, maxAccuracy, lastActiveDay };
}

/** Recompute + persist student_stats, unlock new achievements. Returns the
 *  list of achievement ids unlocked *for the first time* on this call. */
export async function syncStats(userId: string): Promise<{ stats: ComputedStats; newlyUnlocked: string[] }> {
  const stats = await computeStats(userId);
  await db
    .insert(schema.studentStats)
    .values({
      userId, xp: stats.xp, stars: stats.stars, levelsCompleted: stats.levelsCompleted,
      streakDays: stats.streakDays, longestStreak: stats.longestStreak,
      lastActiveDay: stats.lastActiveDay, updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.studentStats.userId,
      set: {
        xp: stats.xp, stars: stats.stars, levelsCompleted: stats.levelsCompleted,
        streakDays: stats.streakDays,
        longestStreak: sql`GREATEST(${schema.studentStats.longestStreak}, ${stats.streakDays})`,
        lastActiveDay: stats.lastActiveDay, updatedAt: new Date(),
      },
    });

  const eligible = ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.id);
  const existing = await db
    .select({ id: schema.studentAchievements.achievementId })
    .from(schema.studentAchievements)
    .where(eq(schema.studentAchievements.userId, userId));
  const have = new Set(existing.map((e) => e.id));
  const newlyUnlocked = eligible.filter((id) => !have.has(id));
  if (newlyUnlocked.length) {
    await db.insert(schema.studentAchievements).values(newlyUnlocked.map((id) => ({ userId, achievementId: id }))).onConflictDoNothing();
  }
  return { stats, newlyUnlocked };
}

export async function getAchievements(userId: string): Promise<{ id: string; unlockedAt: string }[]> {
  const rows = await db
    .select({ id: schema.studentAchievements.achievementId, unlockedAt: schema.studentAchievements.unlockedAt })
    .from(schema.studentAchievements)
    .where(eq(schema.studentAchievements.userId, userId));
  return rows.map((r) => ({ id: r.id, unlockedAt: new Date(r.unlockedAt).toISOString() }));
}
