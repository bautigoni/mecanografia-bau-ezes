import { activitiesByWorld, type Activity } from "./activities";
import { assets, expansionIslandThumbs, expansionWorldBackgrounds } from "../utils/assets";
import { isLevelCompleted, levelState, loadProgress, type CurriculumProgress } from "../utils/progress";
import { getVisibleWorldIds, type UserContext } from "../utils/userContext";

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

/* Position of an island on the horizontally-scrolling world map.
   `x` is in viewport-width units (vw) measured along the whole track, so the
   first worlds keep their original on-screen spots and later worlds continue
   to the right. `y` is a vertical % within the viewport. */
export type MapPosition = {
  x: number;
  y: number;
};

export type World = {
  id: Activity["worldId"];
  slug: Activity["worldId"];
  title: string;
  thumbnail: string;
  background: string;
  /** Background painted behind the actual typing/shortcut gameplay screen. */
  gameplayBg: string;
  route: string;
  levels: Level[];
  levelPositions: LevelPosition[];
  map: MapPosition;
};

/* Per-island level layouts.
   Coordinates are percentages of the 16:9 island scene (1672x941 PNGs) and
   are tuned by eye to the painted stone platforms in each artwork. The
   level-map container in IslandDetailPage locks to aspect-ratio 16/9 so
   these percentages map to the same platform on every viewport. */
/* Generic winding arcs for the expansion islands. Their backgrounds are
   open scenes (no bespoke painted platforms), so the nodes simply float
   along a pleasant path. Two variants keep neighbouring islands from
   looking identical. 8 points cover the longest world (8 levels). */
const genericArcA: LevelPosition[] = [
  { x: 14, y: 72 },
  { x: 26, y: 58 },
  { x: 38, y: 46 },
  { x: 50, y: 40 },
  { x: 62, y: 48 },
  { x: 72, y: 62 },
  { x: 58, y: 74 },
  { x: 44, y: 68 },
];
const genericArcB: LevelPosition[] = [
  { x: 16, y: 64 },
  { x: 30, y: 72 },
  { x: 42, y: 58 },
  { x: 54, y: 44 },
  { x: 66, y: 52 },
  { x: 74, y: 68 },
  { x: 60, y: 40 },
  { x: 46, y: 56 },
];

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
  // Expansion islands reuse the generic floating arcs.
  island6: genericArcA,
  island7: genericArcB,
  island8: genericArcA,
  island9: genericArcB,
  island10: genericArcA,
  island11: genericArcB,
  island12: genericArcA,
  island13: genericArcB,
  island14: genericArcA,
  island15: genericArcB,
};

type WorldMetaEntry = {
  title: string;
  thumbnail: string;
  background: string;
  gameplayBg: string;
  positions: LevelPosition[];
  map: MapPosition;
};

/* Titles for the 10 expansion islands, in island6 → island15 order. */
const expansionTitles = [
  "Isla de la escritura",
  "Isla de palabras largas",
  "Isla de los signos",
  "Isla de los correos",
  "Isla de las búsquedas",
  "Isla de los comandos",
  "Isla de ventanas",
  "Isla de los mensajes",
  "Isla de atajos",
  "Isla del gran reto",
];

/* =====================================================================
   Pedagogical world order (difficulty, easiest → hardest):
     1  island1  – basic letters / home row / vowels
     2  island6  – writing: syllables → short words
     3  island2  – short words (3–6 letters, phrases)
     4  island7  – long words + longer phrases
     5  island13 – friendly messages in context
     6  island3  – library: uppercase, ñ, accents, ¿¡
     7  island8  – signs / punctuation
     8  island4  – symbols / code (@ + full punctuation mix)
     9  island9  – email writing
    10  island10 – browser searches
    11  island5  – digital / mouse skills
    12  island11 – basic keyboard commands (Enter → Ctrl+F)
    13  island12 – windows & tabs shortcuts (Ctrl+T/W/Tab)
    14  island14 – advanced shortcuts
    15  island15 – grand final challenge
===================================================================== */

/* Map placement: x is vw from left-edge of the track, y is % of viewport
   height.  Islands alternate high (y≈11) and low (y≈49) to create the
   classic staircase-path look.  Spacing is 17 vw between each island. */
const worldMapPositions: Record<Activity["worldId"], MapPosition> = {
  island1:  { x:  6, y: 13 },  // #1
  island6:  { x: 23, y: 49 },  // #2
  island2:  { x: 40, y: 13 },  // #3
  island7:  { x: 57, y: 49 },  // #4
  island13: { x: 74, y: 13 },  // #5
  island3:  { x: 91, y: 49 },  // #6
  island8:  { x: 108, y: 13 }, // #7
  island4:  { x: 125, y: 49 }, // #8
  island9:  { x: 142, y: 13 }, // #9
  island10: { x: 159, y: 49 }, // #10
  island5:  { x: 176, y: 13 }, // #11
  island11: { x: 193, y: 49 }, // #12
  island12: { x: 210, y: 13 }, // #13
  island14: { x: 227, y: 49 }, // #14
  island15: { x: 244, y: 13 }, // #15
};

/* Build the meta for an expansion island (island6 … island15). */
function expansionMeta(worldId: Activity["worldId"], index: number): WorldMetaEntry {
  return {
    title: expansionTitles[index],
    thumbnail: expansionIslandThumbs[index],
    background: expansionWorldBackgrounds[index],
    gameplayBg: expansionWorldBackgrounds[index],
    positions: islandLevelLayouts[worldId],
    map: worldMapPositions[worldId],
  };
}

const worldMeta: Record<Activity["worldId"], WorldMetaEntry> = {
  island1: {
    title: "Isla de teclas",
    thumbnail: assets.worldsIsland1,
    background: assets.island1,
    gameplayBg: assets.gameplayBg,
    positions: islandLevelLayouts.island1,
    map: worldMapPositions.island1,
  },
  island2: {
    title: "Isla de palabras",
    thumbnail: assets.worldsIsland2,
    background: assets.island2,
    gameplayBg: assets.gameplayBg,
    positions: islandLevelLayouts.island2,
    map: worldMapPositions.island2,
  },
  island3: {
    title: "Isla de la biblioteca",
    thumbnail: assets.worldsIsland3,
    background: assets.island3,
    gameplayBg: assets.gameplayBg,
    positions: islandLevelLayouts.island3,
    map: worldMapPositions.island3,
  },
  island4: {
    title: "Isla del árbol",
    thumbnail: assets.worldsIsland4,
    background: assets.island4,
    gameplayBg: assets.gameplayBg,
    positions: islandLevelLayouts.island4,
    map: worldMapPositions.island4,
  },
  island5: {
    title: "Isla digital",
    thumbnail: assets.worldsIsland5,
    background: assets.island5,
    gameplayBg: assets.gameplayBg,
    positions: islandLevelLayouts.island5,
    map: worldMapPositions.island5,
  },
  island6: expansionMeta("island6", 0),
  island7: expansionMeta("island7", 1),
  island8: expansionMeta("island8", 2),
  island9: expansionMeta("island9", 3),
  island10: expansionMeta("island10", 4),
  island11: expansionMeta("island11", 5),
  island12: expansionMeta("island12", 6),
  island13: expansionMeta("island13", 7),
  island14: expansionMeta("island14", 8),
  island15: expansionMeta("island15", 9),
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
    gameplayBg: meta.gameplayBg,
    route: `/worlds/${worldId}`,
    levels: buildLevels(worldId, progress),
    levelPositions: meta.positions,
    map: meta.map,
  };
}

/* Background painted behind the gameplay screen for a given world. Existing
   worlds keep the shared painted scene; expansion worlds use their own art. */
export function getGameplayBackground(worldId: Activity["worldId"]): string {
  return worldMeta[worldId]?.gameplayBg ?? assets.gameplayBg;
}

/* Progression order of the five worlds. NOTE: the digital-skills island
   (island5) is the SECOND world in the learning path even though it sits in
   the bottom-right of the map — its on-screen position is unchanged, only its
   place in the sequence. Everything that needs a "Mundo N" number or an
   unlock order derives it from this array. */
/** Canonical difficulty order used for progression unlocking and the
 *  free-path display.  See the comment above worldMapPositions for the
 *  pedagogical rationale. */
export const WORLD_ORDER: Activity["worldId"][] = [
  "island1",   // 1  basic letters
  "island6",   // 2  syllables + short words
  "island2",   // 3  words
  "island7",   // 4  long words + phrases
  "island13",  // 5  friendly messages
  "island3",   // 6  uppercase, ñ, accents
  "island8",   // 7  punctuation & signs
  "island4",   // 8  symbols & code
  "island9",   // 9  email writing
  "island10",  // 10 browser searches
  "island5",   // 11 digital / mouse skills
  "island11",  // 12 basic keyboard commands
  "island12",  // 13 windows & tabs
  "island14",  // 14 advanced shortcuts
  "island15",  // 15 grand final challenge
];

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

/** Returns worlds filtered to those visible for a specific user context.
 *  Pass the result of getUserContext() from userContext.ts. */
export function getWorldsForUser(
  context: UserContext,
  progress: CurriculumProgress = loadProgress(),
): World[] {
  const visibleIds = getVisibleWorldIds(context);
  return visibleIds.map((id) => buildWorld(id, progress));
}

export type WorldId = World["id"];
export type WorldSlug = World["slug"];
