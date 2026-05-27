import { activitiesByWorld, type Activity } from "../data/activities";

export type WorldKey = Activity["worldId"];

export interface LevelProgress {
  completed: boolean;
  bestAccuracy: number;
  attempts: number;
}

export type WorldProgress = Record<number, LevelProgress>;
export type CurriculumProgress = Record<WorldKey, WorldProgress>;

const STORAGE_KEY = "edutic_progress_v1";

function emptyWorld(): WorldProgress {
  return {};
}

function defaultProgress(): CurriculumProgress {
  return {
    island1: emptyWorld(),
    island2: emptyWorld(),
    island3: emptyWorld(),
    island4: emptyWorld(),
    island5: emptyWorld(),
  };
}

export function loadProgress(): CurriculumProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<CurriculumProgress>;
    return {
      ...defaultProgress(),
      ...parsed,
    } as CurriculumProgress;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: CurriculumProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function markLevelComplete(worldId: WorldKey, levelNumber: number, accuracy: number, attempts: number) {
  const progress = loadProgress();
  const previous = progress[worldId]?.[levelNumber];
  const best = Math.max(previous?.bestAccuracy ?? 0, accuracy);
  progress[worldId] = {
    ...progress[worldId],
    [levelNumber]: { completed: true, bestAccuracy: best, attempts },
  };
  saveProgress(progress);
}

export function isLevelCompleted(progress: CurriculumProgress, worldId: WorldKey, levelNumber: number): boolean {
  return Boolean(progress[worldId]?.[levelNumber]?.completed);
}

export function getCurrentLevelNumber(progress: CurriculumProgress, worldId: WorldKey): number {
  const worldActivities = activitiesByWorld[worldId];
  for (const activity of worldActivities) {
    if (!isLevelCompleted(progress, worldId, activity.levelNumber)) {
      return activity.levelNumber;
    }
  }
  return worldActivities[worldActivities.length - 1].levelNumber;
}

export function levelState(
  progress: CurriculumProgress,
  worldId: WorldKey,
  levelNumber: number,
): "Completado" | "Actual" | "Bloqueado" {
  if (isLevelCompleted(progress, worldId, levelNumber)) return "Completado";
  const current = getCurrentLevelNumber(progress, worldId);
  if (levelNumber === current) return "Actual";
  return "Bloqueado";
}

export function resetProgress() {
  saveProgress(defaultProgress());
}
