import { activitiesByWorld, type Activity } from "./activities";
import { assets } from "../utils/assets";
import { isLevelCompleted, levelState, loadProgress, type CurriculumProgress } from "../utils/progress";

export type LevelState = "Completado" | "Actual" | "Bloqueado";

export type Level = {
  title: string;
  name: string;
  state: LevelState;
  description: string;
  activityId: string;
  levelNumber: number;
};

export type LevelPosition = {
  x: number;
  y: number;
};

export type World = {
  id: Activity["worldId"];
  slug: Activity["worldId"];
  title: string;
  thumbnail: string;
  background: string;
  route: string;
  levels: Level[];
  levelPositions: LevelPosition[];
};

/* Per-island level layouts.
   Coordinates are percentages of the 16:9 island scene (1672x941 PNGs) and
   are tuned by eye to the painted stone platforms in each artwork. The
   level-map container in IslandDetailPage locks to aspect-ratio 16/9 so
   these percentages map to the same platform on every viewport. */
const islandLevelLayouts: Record<Activity["worldId"], LevelPosition[]> = {
  // Isla de teclas (bosque) — winding stone path with 6 platforms.
  island1: [
    { x: 22, y: 72 },
    { x: 33, y: 58 },
    { x: 47, y: 44 },
    { x: 64, y: 50 },
    { x: 52, y: 68 },
    { x: 72, y: 72 },
  ],
  // Isla de palabras (potion/lab) — 6 round pads arranged in a loose arc.
  // Rightmost pad kept at x:72 (matching the other islands) so it never
  // tucks under the right-hand level info panel.
  island2: [
    { x: 28, y: 70 },
    { x: 38, y: 54 },
    { x: 55, y: 42 },
    { x: 72, y: 38 },
    { x: 50, y: 58 },
    { x: 70, y: 70 },
  ],
  // Isla de la biblioteca — book pedestal + 5 stone platforms.
  island3: [
    { x: 24, y: 68 },
    { x: 38, y: 56 },
    { x: 52, y: 44 },
    { x: 66, y: 52 },
    { x: 46, y: 70 },
    { x: 72, y: 70 },
  ],
  // Isla del árbol / código — 6 crystal platforms scattered around the tree.
  island4: [
    { x: 22, y: 70 },
    { x: 36, y: 58 },
    { x: 50, y: 44 },
    { x: 66, y: 52 },
    { x: 48, y: 70 },
    { x: 72, y: 72 },
  ],
  // Isla digital — 7 platforms (winding path: bottom-left → up → right → down).
  // Final pad kept at x:72 so the winding route stays clear of the panel.
  island5: [
    { x: 18, y: 72 },
    { x: 28, y: 58 },
    { x: 40, y: 46 },
    { x: 55, y: 38 },
    { x: 67, y: 48 },
    { x: 56, y: 64 },
    { x: 72, y: 72 },
  ],
};

const worldMeta: Record<Activity["worldId"], { title: string; thumbnail: string; background: string; positions: LevelPosition[] }> = {
  island1: {
    title: "Isla de teclas",
    thumbnail: assets.worldsIsland1,
    background: assets.island1,
    positions: islandLevelLayouts.island1,
  },
  island2: {
    title: "Isla de palabras",
    thumbnail: assets.worldsIsland2,
    background: assets.island2,
    positions: islandLevelLayouts.island2,
  },
  island3: {
    title: "Isla de la biblioteca",
    thumbnail: assets.worldsIsland3,
    background: assets.island3,
    positions: islandLevelLayouts.island3,
  },
  island4: {
    title: "Isla del árbol",
    thumbnail: assets.worldsIsland4,
    background: assets.island4,
    positions: islandLevelLayouts.island4,
  },
  island5: {
    title: "Isla digital",
    thumbnail: assets.worldsIsland5,
    background: assets.island5,
    positions: islandLevelLayouts.island5,
  },
};

function buildLevels(worldId: Activity["worldId"], progress: CurriculumProgress): Level[] {
  return activitiesByWorld[worldId].map((activity) => {
    const state = levelState(progress, worldId, activity.levelNumber);
    const description =
      state === "Bloqueado"
        ? "Completá el nivel anterior para desbloquear este desafío."
        : activity.description;
    return {
      title: `Nivel ${activity.levelNumber}`,
      name: activity.title,
      state,
      description,
      activityId: activity.id,
      levelNumber: activity.levelNumber,
    };
  });
}

function buildWorld(worldId: Activity["worldId"], progress: CurriculumProgress): World {
  const meta = worldMeta[worldId];
  return {
    id: worldId,
    slug: worldId,
    title: meta.title,
    thumbnail: meta.thumbnail,
    background: meta.background,
    route: `/worlds/${worldId}`,
    levels: buildLevels(worldId, progress),
    levelPositions: meta.positions,
  };
}

/* Progression order of the five worlds. NOTE: the digital-skills island
   (island5) is the SECOND world in the learning path even though it sits in
   the bottom-right of the map — its on-screen position is unchanged, only its
   place in the sequence. Everything that needs a "Mundo N" number or an
   unlock order derives it from this array. */
export const WORLD_ORDER: Activity["worldId"][] = ["island1", "island5", "island2", "island3", "island4"];

export type WorldLockState = "completed" | "current" | "locked";

/* A world counts as complete once every one of its levels is completed. */
export function isWorldComplete(worldId: Activity["worldId"], progress: CurriculumProgress): boolean {
  return activitiesByWorld[worldId].every((activity) => isLevelCompleted(progress, worldId, activity.levelNumber));
}

/* Sequential unlocking: a world is "current" once all earlier worlds in
   WORLD_ORDER are complete, "completed" when finished, and "locked" until
   then. Only one world is ever "current". */
export function getWorldStates(
  progress: CurriculumProgress = loadProgress(),
): Record<Activity["worldId"], WorldLockState> {
  const states = {} as Record<Activity["worldId"], WorldLockState>;
  let previousComplete = true;
  for (const id of WORLD_ORDER) {
    if (isWorldComplete(id, progress)) {
      states[id] = "completed";
    } else if (previousComplete) {
      states[id] = "current";
      previousComplete = false;
    } else {
      states[id] = "locked";
    }
  }
  return states;
}

export function getWorlds(progress: CurriculumProgress = loadProgress()): World[] {
  return WORLD_ORDER.map((id) => buildWorld(id, progress));
}

export function getWorldBySlug(slug?: string, progress: CurriculumProgress = loadProgress()): World | undefined {
  if (!slug) return undefined;
  if (!(slug in worldMeta)) return undefined;
  return buildWorld(slug as Activity["worldId"], progress);
}

export const worlds: World[] = getWorlds();

export type WorldId = World["id"];
export type WorldSlug = World["slug"];
