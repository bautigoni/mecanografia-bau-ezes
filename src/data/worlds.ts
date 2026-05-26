import { activitiesByWorld, type Activity } from "./activities";
import { assets } from "../utils/assets";
import { levelState, loadProgress, type CurriculumProgress } from "../utils/progress";

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

const worldMeta: Record<Activity["worldId"], { title: string; thumbnail: string; background: string; positions: LevelPosition[] }> = {
  island1: {
    title: "Isla de teclas",
    thumbnail: assets.worldsIsland1,
    background: assets.island1,
    positions: [
      { x: 17, y: 70 },
      { x: 31, y: 55 },
      { x: 45, y: 46 },
      { x: 63, y: 54 },
      { x: 50, y: 72 },
      { x: 69, y: 73 },
    ],
  },
  island2: {
    title: "Isla de palabras",
    thumbnail: assets.worldsIsland2,
    background: assets.island2,
    positions: [
      { x: 24, y: 68 },
      { x: 36, y: 55 },
      { x: 50, y: 45 },
      { x: 64, y: 58 },
      { x: 44, y: 72 },
      { x: 63, y: 75 },
    ],
  },
  island3: {
    title: "Isla de la biblioteca",
    thumbnail: assets.worldsIsland3,
    background: assets.island3,
    positions: [
      { x: 20, y: 66 },
      { x: 33, y: 54 },
      { x: 48, y: 45 },
      { x: 63, y: 56 },
      { x: 45, y: 72 },
      { x: 65, y: 72 },
    ],
  },
  island4: {
    title: "Isla del árbol",
    thumbnail: assets.worldsIsland4,
    background: assets.island4,
    positions: [
      { x: 21, y: 70 },
      { x: 34, y: 58 },
      { x: 49, y: 45 },
      { x: 64, y: 55 },
      { x: 46, y: 72 },
      { x: 66, y: 74 },
    ],
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

export function getWorlds(progress: CurriculumProgress = loadProgress()): World[] {
  return (Object.keys(worldMeta) as Activity["worldId"][]).map((id) => buildWorld(id, progress));
}

export function getWorldBySlug(slug?: string, progress: CurriculumProgress = loadProgress()): World | undefined {
  if (!slug) return undefined;
  if (!(slug in worldMeta)) return undefined;
  return buildWorld(slug as Activity["worldId"], progress);
}

export const worlds: World[] = getWorlds();

export type WorldId = World["id"];
export type WorldSlug = World["slug"];
