import type { Activity } from "./activities";

/* =====================================================================
   LEVEL MARKER POSITIONS  ·  single source of truth
   ---------------------------------------------------------------------
   Each entry is the position of a level marker over its island artwork,
    expressed as PERCENTAGES of the level map container (the level-map
    <section> in IslandDetailPage, which covers the whole island stage):

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
  /** Uniform scale (1 = normal). */
  scale?: number;
  /** 3D tilt backward/forward in degrees. Positive = top tilts away, like lying on the ground. */
  rotateX?: number;
  /** 3D tilt left/right in degrees. */
  rotateY?: number;
  /** 2D spin rotation in degrees. */
  rotateZ?: number;
  /** Perspective depth in px. Lower = stronger 3D effect (camera closer). Default ~500. */
  perspective?: number;
};

/* Per-island level marker positions, placed by hand with the visual editor
   over each island's painted platforms. Coordinates are percentages of the
   ISLAND IMAGE itself — NOT the viewport. islandDetailPage translates them
   to container-relative at render time, which keeps nodes aligned to the
   painted platforms on every screen size regardless of object-fit cropping.

   Each island keeps its own level count (6, 7 or 8) and the order matches
   the level order (index 0 = level 1, index 1 = level 2, …). */
export const islandLevelLayouts: Record<Activity["worldId"], LevelPosition[]> = {
  island1: [
    { x: 35.3, y: 53.9, scale: 1.5, rotateX: -11, perspective: 290 },
    { x: 28.1, y: 42.5, scale: 1.3 },
    { x: 42.7, y: 34.2, scale: 1.3, rotateX: 27 },
    { x: 61.5, y: 29.4, scale: 1.4, rotateX: 21.5 },
    { x: 72.8, y: 37.9, scale: 1.4, rotateX: 25 },
    { x: 59.1, y: 49.7, scale: 1.5, rotateX: 4.5, perspective: 80 },
    { x: 73.6, y: 54.9, scale: 1.5, rotateX: -7, perspective: 670 },
  ],

  island2: [
    /* Layout matches the painted scene in island2.webp (1672×941, 16:9):
       one big foreground chain (bottom half) plus a few smaller top platforms.
       Coordinates are % of the island image (cover-rect math in IslandDetailPage
       keeps them locked to the platforms at every viewport). */
    { x: 43, y: 68 },   // N1 — round platform w/ blue glow (left of chain)
    { x: 63, y: 76 },   // N2 — right side of the bottom chain
    { x: 37, y: 78 },   // N3 — left platform of the bottom chain
    { x: 50, y: 48 },   // N4 — center of the chain (mid-height)
    { x: 24, y: 55 },   // N5 — left mid platform (smaller, mid-left)
    { x: 45, y: 12 },   // N6 — top-left upper platform
  ],

  island3: [
    /* island3.webp: ONE big central painted chain (the cluster in the
       heatmap at x 20-70, y 30-95). All 7 levels ride the chain in a
       logical path; no separate top/right platforms exist in the art. */
    { x: 53, y: 48 },   // N1 — upper-centre of the main chain
    { x: 57, y: 60 },   // N2 — slightly down-right
    { x: 67, y: 66 },   // N3 — bottom-right of the main chain
    { x: 53, y: 90 },   // N4 — bottom-centre
    { x: 30, y: 69 },   // N5 — bottom-left
    { x: 27, y: 59 },   // N6 — mid-left
    { x: 35, y: 42 },   // N7 — upper-left
  ],

  island4: [
    /* island4.webp: ONE big central painted chain (the main island). The
       "bottom-right small platform" in earlier art isn't a real platform
       in the painted scene (it's just decorative clouds), so all 6 levels
       ride the main chain in a path. */
    { x: 49, y: 42 },   // N1 — upper-centre of the main chain
    { x: 67, y: 60 },   // N2 — centre-right
    { x: 52, y: 71 },   // N3 — centre of the main chain
    { x: 38, y: 76 },   // N4 — bottom-centre
    { x: 32, y: 62 },   // N5 — mid-left of the main chain
    { x: 72, y: 74 },   // N6 — bottom-right of the main chain
  ],

  island5: [
    /* island5.webp: top decoration + one big central chain. The top pixels
       at y 5-15 read as pastel sky (excluded by the strict detector), so
       levels 1-7 follow the main chain in a path. */
    { x: 31, y: 28 },   // N1 — upper-left of the main chain
    { x: 41, y: 39 },   // N2 — upper-centre
    { x: 53, y: 45 },   // N3 — right of main
    { x: 43, y: 53 },   // N4 — centre of main
    { x: 28, y: 46 },   // N5 — left of main
    { x: 31, y: 38 },   // N6 — upper-left, slightly above
    { x: 42, y: 39 },   // N7 — centre, near N2
  ],

  island6: [
    /* Mundo 2 "Isla de la escritura" — fondo bg01_crystal_portal.webp (1672×941).
       Coordenadas = % de la imagen (la cover-rect math de IslandDetailPage las
       fija a las plataformas pintadas en cualquier viewport). Cadena que sube
       desde el disco de abajo-izquierda hasta el portal. 7 niveles. */
    { x: 20, y: 87 },   // N1 — disco rúnico abajo-izquierda (inicio, lleva la nave)
    { x: 24, y: 47 },   // N2 — disco de la cornisa izquierda
    { x: 34, y: 38 },   // N3 — terraza verde sobre la cornisa
    { x: 45, y: 31 },   // N4 — escalones de piedra hacia el centro
    { x: 55, y: 48 },   // N5 — disco rúnico central
    { x: 76, y: 61 },   // N6 — disco rúnico derecho (abajo)
    { x: 60, y: 23 },   // N7 — explanada al pie del portal
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
