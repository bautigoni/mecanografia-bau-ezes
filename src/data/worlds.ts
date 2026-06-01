import { activitiesByWorld, type Activity } from "./activities";
import { assets, expansionIslandThumbs, islandDetailBackgrounds, gameplayBackgrounds } from "../utils/assets";
import {
  getBestStarsForLevel,
  getWorldStarProgress,
  isLevelCompleted,
  levelState,
  loadProgress,
  type CurriculumProgress,
  type WorldStarProgress,
} from "../utils/progress";
import { getVisibleWorldIds, type UserContext } from "../utils/userContext";

/* =====================================================================
   GAMEPLAY BACKGROUND MAPPING.
   - Original worlds 1-5 KEEP their single original painted gameplay scene
     (assets.gameplayBg). They are NOT remapped to the new folder.
   - New worlds 6-15 each get their theme-matched gameplay scene from
     /typely_gameplay_background_webp, by expansion index (0→island6 …
     9→island15), which lines up 1:1 with their thumbnail + detail theme.
   worldId -> gameplay background file
===================================================================== */
const GAMEPLAY_BACKGROUND_BY_WORLD: Record<Activity["worldId"], string> = {
  // Originals — preserved.
  island1: assets.gameplayBg,
  island2: assets.gameplayBg,
  island3: assets.gameplayBg,
  island4: assets.gameplayBg,
  island5: assets.gameplayBg,
  // New worlds — theme-matched (expansion index → gameplayBackgrounds index).
  island6:  gameplayBackgrounds[0], // crystal portal
  island7:  gameplayBackgrounds[1], // garden library
  island8:  gameplayBackgrounds[2], // frozen clockwork
  island9:  gameplayBackgrounds[3], // autumn artist
  island10: gameplayBackgrounds[4], // jungle ruins
  island11: gameplayBackgrounds[5], // candyland
  island12: gameplayBackgrounds[6], // desert canyon
  island13: gameplayBackgrounds[7], // rainbow playground
  island14: gameplayBackgrounds[8], // alchemy lab
  island15: gameplayBackgrounds[9], // lagoon
};

export type LevelState = "Completado" | "Actual" | "Bloqueado";

export type Level = {
  title: string;
  name: string;
  state: LevelState;
  description: string;
  activityId: string;
  levelNumber: number;
  /** Best stars earned in this level (0-3), derived from best accuracy. */
  stars: number;
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
  /** Short topic/theme label shown to teachers (e.g. "Atajos de teclado"). */
  topic: string;
  /** 1-based difficulty order (position in WORLD_ORDER). */
  order: number;
  thumbnail: string;
  background: string;
  /** Background painted behind the actual typing/shortcut gameplay screen. */
  gameplayBg: string;
  route: string;
  levels: Level[];
  levelPositions: LevelPosition[];
  map: MapPosition;
};

/* Teacher-facing topic/theme per world. */
export const WORLD_TOPICS: Record<Activity["worldId"], string> = {
  island1: "Escritura — primeras teclas",
  island6: "Escritura",
  island2: "Palabras",
  island7: "Palabras largas",
  island13: "Mensajes",
  island3: "Signos y tildes",
  island8: "Signos",
  island4: "Símbolos y código",
  island9: "Mails",
  island10: "Búsquedas en navegador",
  island5: "Mouse y habilidades digitales",
  island11: "Comandos básicos",
  island12: "Ventanas y pestañas",
  island14: "Comandos avanzados",
  island15: "Reto final",
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

/* Build the meta for an expansion island (island6 … island15).
   - thumbnail (world map)        → floating island art
   - background (island detail)   → scene WITH platforms (typely_backgrounds_webp)
   - gameplayBg (gameplay screen) → central-stage scene (gameplay folder)
   All three share the same theme via the expansion index. */
function expansionMeta(worldId: Activity["worldId"], index: number): WorldMetaEntry {
  return {
    title: expansionTitles[index],
    thumbnail: expansionIslandThumbs[index],
    background: islandDetailBackgrounds[index],
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD[worldId],
    positions: islandLevelLayouts[worldId],
    map: worldMapPositions[worldId],
  };
}

const worldMeta: Record<Activity["worldId"], WorldMetaEntry> = {
  island1: {
    title: "Isla de teclas",
    thumbnail: assets.worldsIsland1,
    background: assets.island1,
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD.island1,
    positions: islandLevelLayouts.island1,
    map: worldMapPositions.island1,
  },
  island2: {
    title: "Isla de palabras",
    thumbnail: assets.worldsIsland2,
    background: assets.island2,
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD.island2,
    positions: islandLevelLayouts.island2,
    map: worldMapPositions.island2,
  },
  island3: {
    title: "Isla de la biblioteca",
    thumbnail: assets.worldsIsland3,
    background: assets.island3,
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD.island3,
    positions: islandLevelLayouts.island3,
    map: worldMapPositions.island3,
  },
  island4: {
    title: "Isla del árbol",
    thumbnail: assets.worldsIsland4,
    background: assets.island4,
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD.island4,
    positions: islandLevelLayouts.island4,
    map: worldMapPositions.island4,
  },
  island5: {
    title: "Isla digital",
    thumbnail: assets.worldsIsland5,
    background: assets.island5,
    gameplayBg: GAMEPLAY_BACKGROUND_BY_WORLD.island5,
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
      stars: getBestStarsForLevel(progress, worldId, activity.levelNumber),
    };
  });
}

function buildWorld(worldId: Activity["worldId"], progress: CurriculumProgress): World {
  const meta = worldMeta[worldId];
  return {
    id: worldId,
    slug: worldId,
    title: meta.title,
    topic: WORLD_TOPICS[worldId],
    order: WORLD_ORDER.indexOf(worldId) + 1,
    thumbnail: meta.thumbnail,
    background: meta.background,
    gameplayBg: meta.gameplayBg,
    route: `/worlds/${worldId}`,
    levels: buildLevels(worldId, progress),
    levelPositions: meta.positions,
    map: meta.map,
  };
}

/* Background painted behind the gameplay screen for a given world.
   ALWAYS resolves to a scene in /typely_gameplay_background_webp — never the
   island thumbnail, the old backgrounds set, or the fallback gameplay-bg. */
export function getGameplayBackground(worldId: Activity["worldId"]): string {
  return GAMEPLAY_BACKGROUND_BY_WORLD[worldId] ?? gameplayBackgrounds[0];
}

/** Alias with the descriptive name used elsewhere in the codebase. */
export const getGameplayBackgroundForWorld = getGameplayBackground;

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

/* A world counts as fully complete once every level is completed (all levels
   done). Kept for callers that need the strict "all levels done" check. */
export function isWorldComplete(worldId: Activity["worldId"], progress: CurriculumProgress): boolean {
  return activitiesByWorld[worldId].every((activity) => isLevelCompleted(progress, worldId, activity.levelNumber));
}

/** Star progress for a world (re-exported for UI). */
export function worldStarProgress(
  worldId: Activity["worldId"],
  progress: CurriculumProgress = loadProgress(),
): WorldStarProgress {
  return getWorldStarProgress(progress, worldId);
}

/* Build lock states over an ORDERED list of worldIds using the 70%-stars
   rule: the first world is unlocked; each next world unlocks only once the
   previous one has earned ≥70% of its possible stars.
     - "completed" → this world has already reached the 70% star gate.
     - "current"   → unlocked and being worked on (first world below 70%).
     - "locked"    → previous world has not reached 70% yet.
   When `unlockAll` is true (free path: demo / superadmin / teacher) nothing
   is ever locked. */
function buildStarStates(
  orderedIds: Activity["worldId"][],
  progress: CurriculumProgress,
  unlockAll: boolean,
): Record<string, WorldLockState> {
  const states: Record<string, WorldLockState> = {};
  let previousUnlocksNext = true; // the first world is always available
  for (const id of orderedIds) {
    const reached = getWorldStarProgress(progress, id).isUnlockedNext;
    if (unlockAll) {
      states[id] = reached ? "completed" : "current";
      continue;
    }
    if (!previousUnlocksNext) {
      states[id] = "locked";
      continue;
    }
    states[id] = reached ? "completed" : "current";
    previousUnlocksNext = reached;
  }
  return states;
}

/* Sequential unlocking over the full WORLD_ORDER (no user context).
   Uses the 70%-stars rule. */
export function getWorldStates(
  progress: CurriculumProgress = loadProgress(),
): Record<Activity["worldId"], WorldLockState> {
  return buildStarStates(WORLD_ORDER, progress, false) as Record<Activity["worldId"], WorldLockState>;
}

/* Context-aware lock states. The 70%-stars chain is applied to EVERY user
   over their ordered worlds, so the unlock gate is real while playing — you
   must earn 70% of a world's stars to open the next one. Demo / superadmin
   still SEE every world (visibility is handled by getWorldsForUser); locked
   ones simply appear greyed and can be opened with the hidden 5-click dev
   bypass for testing. */
export function getWorldStatesForUser(
  context: UserContext,
  progress: CurriculumProgress = loadProgress(),
): Record<string, WorldLockState> {
  const orderedIds = getWorldsForUser(context, progress).map((w) => w.id);
  return buildStarStates(orderedIds, progress, false);
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

/** Returns worlds visible for a specific user context.
 *
 *  - Demo mode / superadmin / teacher / admin (free path) → EVERY world in
 *    difficulty order, taken directly from WORLD_ORDER. This is independent
 *    of any course/grade list, so it can never be accidentally filtered down
 *    (this is what previously cut demo mode to a 3EP-sized 7 worlds).
 *  - Real students (course path) → only the worlds for their grade, further
 *    narrowed by the teacher's per-class island selection.
 *
 *  Pass the result of getUserContext() from userContext.ts. */
export function getWorldsForUser(
  context: UserContext,
  progress: CurriculumProgress = loadProgress(),
): World[] {
  // Free path: all worlds, always complete, ordered by difficulty.
  if (!context.isCoursePath) {
    return WORLD_ORDER.map((id) => buildWorld(id, progress));
  }
  // Course path: grade + teacher selection (handled in getVisibleWorldIds).
  const visibleIds = getVisibleWorldIds(context);
  return visibleIds.map((id) => buildWorld(id, progress));
}

/** All worlds ordered by difficulty (the canonical free-path list). */
export function getAllWorldsOrderedByDifficulty(
  progress: CurriculumProgress = loadProgress(),
): World[] {
  return WORLD_ORDER.map((id) => buildWorld(id, progress));
}

export type WorldId = World["id"];
export type WorldSlug = World["slug"];
