import type { Activity } from "./activities";

/* =====================================================================
   LEVEL MARKER POSITIONS  ·  single source of truth
   ---------------------------------------------------------------------
   Each entry is the position of a level marker over its island artwork,
   expressed as PERCENTAGES of the level map container (the `.level-map`
   box in IslandDetailPage, which covers the whole island stage):

     x → horizontal %, 0 = left edge, 100 = right edge
     y → vertical %,   0 = top edge,  100 = bottom edge

   The marker is centered on (x, y) — CSS applies translate(-50%, -50%) —
   so x/y is the CENTER of the level bubble, which should sit on the
   center of the painted platform.

   These are percentages (never pixels), so they stay aligned when the
   screen resizes. The island background uses object-fit: cover, so for
   pixel-perfect placement edit at the aspect ratio you ship at.

   HOW TO EDIT BY HAND:
     - Tweak the numbers below, or
     - Open an island in dev with the visual editor (see
       src/components/dev/LevelPositionEditor + IslandDetailPage):
         1. visit  /worlds/<islandId>?editor=1   (dev build only)
         2. drag each numbered marker onto its platform
         3. click "Copiar arreglo" and paste the array back here.

   Level counts vary per island (6, 7 or 8) — each array keeps exactly the
   number of markers that island needs; they are not padded to a fixed size.
===================================================================== */

export type LevelPosition = {
  x: number;
  y: number;
};

/* Per-island level marker positions, placed by hand with the visual editor
   over each island's painted platforms. Coordinates are % of the level-map
   box (see header). Each island keeps its own level count (6, 7 or 8) and the
   order matches the level order (index 0 = level 1, index 1 = level 2, …). */
export const islandLevelLayouts: Record<Activity["worldId"], LevelPosition[]> = {
  island1: [
    { x: 33, y: 70.7 },
    { x: 26.4, y: 50.2 },
    { x: 38.7, y: 40.3 },
    { x: 56.8, y: 33.7 },
    { x: 68.5, y: 45.6 },
    { x: 54.4, y: 67.5 },
    { x: 68.8, y: 74.7 },
  ],

  island2: [
    { x: 46.7, y: 77.9 },
    { x: 33.4, y: 67.7 },
    { x: 32.3, y: 44.7 },
    { x: 52.7, y: 26.7 },
    { x: 68.3, y: 34.3 },
    { x: 63.4, y: 61.1 },
  ],

  island3: [
    { x: 51.1, y: 57.4 },
    { x: 41, y: 64.8 },
    { x: 33.4, y: 53.6 },
    { x: 40.9, y: 41.2 },
    { x: 55.2, y: 32.1 },
    { x: 66.1, y: 43.1 },
    { x: 70.6, y: 62.2 },
  ],

  island4: [
    { x: 39, y: 62.9 },
    { x: 41.5, y: 39 },
    { x: 51, y: 19.5 },
    { x: 63.9, y: 35 },
    { x: 69.6, y: 47.6 },
    { x: 54, y: 57.7 },
  ],

  island5: [
    { x: 21.9, y: 71.2 },
    { x: 34.7, y: 42.6 },
    { x: 51, y: 51.9 },
    { x: 48.1, y: 75.4 },
    { x: 61.2, y: 36.3 },
    { x: 48.4, y: 27.1 },
    { x: 87, y: 56.3 },
  ],

  island6: [
    { x: 20.8, y: 88.9 },
    { x: 18.6, y: 46.3 },
    { x: 29.1, y: 34 },
    { x: 46, y: 28.1 },
    { x: 57.9, y: 37.9 },
    { x: 74.2, y: 60.8 },
    { x: 62.9, y: 13.6 },
    { x: 44, y: 68 },
  ],

  island7: [
    { x: 25.3, y: 82.5 },
    { x: 28.6, y: 40.6 },
    { x: 46.5, y: 93.3 },
    { x: 73.9, y: 79 },
    { x: 79.7, y: 33.2 },
    { x: 52, y: 40.2 },
    // Nudged a few % right + down (2026-06-02) so the marker clears the
    // next-world entrance overlay that was eating the click target.
    { x: 63, y: 43 },
    { x: 46, y: 56 },
  ],

  island8: [
    { x: 18.5, y: 35.4 },
    { x: 27.9, y: 78.5 },
    { x: 41.3, y: 92.8 },
    { x: 73.6, y: 83.4 },
    { x: 78.9, y: 59.9 },
    { x: 77.1, y: 25.1 },
    // Nudged a few % left + down (2026-06-02) so the marker clears the
    // next-world entrance overlay that was eating the click target.
    { x: 47, y: 15.5 },
    { x: 44, y: 68 },
  ],

  island9: [
    { x: 23.2, y: 90 },
    { x: 37.4, y: 76.6 },
    { x: 33.8, y: 50.7 },
    { x: 47.1, y: 43.2 },
    { x: 54.9, y: 18.3 },
    { x: 67.1, y: 35 },
    { x: 83.5, y: 17 },
    { x: 46, y: 56 },
  ],

  island10: [
    { x: 16.8, y: 20.3 },
    { x: 32.8, y: 32.3 },
    { x: 15.8, y: 64 },
    { x: 36.2, y: 90.3 },
    { x: 61.3, y: 64.9 },
    { x: 76.4, y: 40.9 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island11: [
    { x: 28.4, y: 79.4 },
    { x: 23.5, y: 43.1 },
    { x: 42.8, y: 38.6 },
    { x: 51, y: 77.4 },
    { x: 70.9, y: 58.9 },
    { x: 61, y: 33.9 },
    { x: 81.5, y: 25.6 },
    { x: 46, y: 56 },
  ],

  island12: [
    { x: 13.8, y: 43.6 },
    { x: 29.5, y: 75.3 },
    { x: 41, y: 22.4 },
    { x: 58.6, y: 40.8 },
    { x: 71.2, y: 68.1 },
    { x: 81.1, y: 41.5 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island13: [
    { x: 16.7, y: 57.4 },
    { x: 43.3, y: 66.6 },
    { x: 74.1, y: 62.8 },
    { x: 56.1, y: 42.4 },
    { x: 35.7, y: 16.9 },
    { x: 54.9, y: 12.6 },
    { x: 60, y: 40 },
    { x: 46, y: 56 },
  ],

  island14: [
    { x: 21.1, y: 48.8 },
    { x: 41.7, y: 30.9 },
    { x: 57.1, y: 44.2 },
    { x: 46.7, y: 78.1 },
    { x: 64.3, y: 75.2 },
    { x: 81.1, y: 65.8 },
    { x: 58, y: 74 },
    { x: 44, y: 68 },
  ],

  island15: [
    { x: 20.8, y: 79.3 },
    { x: 36.8, y: 62 },
    { x: 28.3, y: 25.5 },
    { x: 43.9, y: 2.7 },
    { x: 53.6, y: 45.5 },
    { x: 78.5, y: 53.3 },
    { x: 51.8, y: 89.9 },
    { x: 87.2, y: 82.5 },
  ],
};
