/**
 * Centralised asset paths for the app.
 *
 * Every entry points to the optimised WebP build produced by
 * `scripts/optimize_images.py`. The original PNG sources are kept on disk
 * untouched so artists and the existing `Images-new/` pipeline can still
 * regenerate them — only the *web* references go through WebP. If a kid is
 * on a browser without WebP (extremely rare in 2026: <0.4% globally), the
 * `<picture>` fallback in `Img.tsx` lets us re-introduce the PNG without
 * editing this file again.
 */
export const assets = {
  loginBg: "/assets/edutic-art/login-sky-islands-bg.webp",
  homeBg: "/assets/edutic-art/sky-soft-bg.webp",
  gameplayBg: "/assets/edutic-art/gameplay-bg.webp",

  // Male mascot.
  mascotMaleWave: "/assets/edutic-art/mascot-wave.webp",
  mascotMaleJump: "/assets/edutic-art/mascot-jump.webp",
  mascotMaleProud: "/assets/edutic-art/mascot-proud.webp",
  mascotMaleLaptop: "/assets/edutic-art/mascot-laptop.webp",
  mascotMaleNatural: "/assets/edutic-art/mascot-natural.webp",

  // Female mascot.
  mascotFemaleWave: "/assets/edutic-art/mascot-women-wave.webp",
  mascotFemaleLaptop: "/assets/edutic-art/mascot-women-laptop.webp",

  /* Small, high-quality map thumbnails (see Images-new/process_map_thumbs.py).
     The big detail art lives elsewhere; the map only needs these. */
  worldsIsland1: "/typely_islands_thumb_webp/worlds-island1-transparent.webp",
  worldsIsland2: "/typely_islands_thumb_webp/worlds-island2-transparent.webp",
  worldsIsland3: "/typely_islands_thumb_webp/worlds-island3-transparent.webp",
  worldsIsland4: "/typely_islands_thumb_webp/worlds-island4-transparent.webp",
  worldsIsland5: "/typely_islands_thumb_webp/world-island5.webp",
  island1: "/assets/edutic-art/island1.webp",
  island2: "/assets/edutic-art/island2.webp",
  island3: "/assets/edutic-art/island3.webp",
  island4: "/assets/edutic-art/island4.webp",
  island5: "/assets/edutic-art/island5.webp",
  shipFront: "/assets/edutic-art/spaceships/ship-front.webp",
  shipBack: "/assets/edutic-art/spaceships/ship-back.webp",
  shipLeft: "/assets/edutic-art/spaceships/ship-left.webp",
  shipRight: "/assets/edutic-art/spaceships/ship-right.webp",
  shipDiagonalLeft: "/assets/edutic-art/spaceships/ship-diagonal-left.webp",
  shipDiagonalRight: "/assets/edutic-art/spaceships/ship-diagonal-right.webp",
  /* 3D level button images (pre-rendered at base perspective, no number). */
  levelButton: "/assets/level.png",
  levelButtonPressed: "/assets/pressed_level.png",

  /* Island 5 props — used by SkillLevelView for the mouse-skill levels. */
  i5Star:    "/assets/edutic-art/island5/star.webp",
  i5Apple:   "/assets/edutic-art/island5/apple.webp",
  i5Rabbit:  "/assets/edutic-art/island5/rabbit.webp",
  i5Ball:    "/assets/edutic-art/island5/ball.webp",
  i5Shot:    "/assets/edutic-art/island5/shot.webp",
  i5Penguin: "/assets/edutic-art/island5/penguin.webp",
  i5Bag:     "/assets/edutic-art/island5/bag.webp",
  i5Chest:   "/assets/edutic-art/island5/cofre.webp",
  i5Potion:  "/assets/edutic-art/island5/potion.webp",
  i5Apps:    "/assets/edutic-art/island5/apps.webp",
  i5WindowControls: "/assets/edutic-art/island5/cerrar-maximizar-minimizar-ventana.webp",
  i5Message: "/assets/edutic-art/island5/mensaje.webp",
  i5Notes:   "/assets/edutic-art/island5/notas.webp",
  i5WindowMedia: "/assets/edutic-art/island5/ventana-mismedios.webp",
  i5BrowserTabs: "/assets/edutic-art/island5/pestanas-explorador-videos-dibujos.webp",
  i5DrawingsWindow: "/assets/edutic-art/island5/dibujos-ventana.webp",
  i5Mouse:   "/assets/edutic-art/island5/mouse.webp",
  i5CastleVertical: "/assets/edutic-art/island5/castillo-vertical.webp",
  i5CastleSquare:   "/assets/edutic-art/island5/castillo-cuadrada.webp",
  i5ZoomBtns:       "/assets/edutic-art/island5/zoom-mas-menos.webp",
};

/* =====================================================================
   Expansion islands (island6 … island15) — THREE separate image families.
   They must NEVER be mixed. Index 0 → island6 … index 9 → island15, and
   all three share the SAME theme order (crystal, garden, frozen, autumn,
   jungle, candyland, desert, rainbow, alchemy, lagoon) so a single world's
   thumbnail + detail map + gameplay scene always match thematically.
===================================================================== */

/* 1) WORLD MAP IMAGE — the floating island art on the worlds-selection map.
      Transparent islands shown small in the sky (from /typely_islands_webp). */
export const expansionIslandThumbs: string[] = [
  "/typely_islands_thumb_webp/background-island1.webp",  // crystal
  "/typely_islands_thumb_webp/background-island2.webp",  // garden / library
  "/typely_islands_thumb_webp/background-island3.webp",  // frozen / clockwork
  "/typely_islands_thumb_webp/background-island4.webp",  // autumn / artist
  "/typely_islands_thumb_webp/background-island5.webp",  // jungle / ruins
  "/typely_islands_thumb_webp/background-island6.webp",  // candyland
  "/typely_islands_thumb_webp/background-island7.webp",  // desert / canyon
  "/typely_islands_thumb_webp/background-island8.webp",  // rainbow / playground
  "/typely_islands_thumb_webp/background-island9.webp",  // alchemy / lab
  "/typely_islands_thumb_webp/background-island10.webp", // lagoon
];

/* 2) ISLAND DETAIL BACKGROUND — the full 16:9 scene WITH painted platforms,
      shown behind the level-selection nodes (from /typely_backgrounds_webp).
      These are NOT gameplay backgrounds — they contain platforms. */
export const islandDetailBackgrounds: string[] = [
  "/typely_backgrounds_webp/bg01_crystal_portal.webp",
  "/typely_backgrounds_webp/bg02_garden_library.webp",
  "/typely_backgrounds_webp/bg03_frozen_clockwork.webp",
  "/typely_backgrounds_webp/bg04_autumn_artist.webp",
  "/typely_backgrounds_webp/bg05_jungle_ruins.webp",
  "/typely_backgrounds_webp/bg06_candyland.webp",
  "/typely_backgrounds_webp/bg07_desert_canyon.webp",
  "/typely_backgrounds_webp/bg08_rainbow_playground.webp",
  "/typely_backgrounds_webp/bg09_alchemy_lab.webp",
  "/typely_backgrounds_webp/bg10_lagoon.webp",
];

/* 3) GAMEPLAY BACKGROUND — the single central-stage scene painted behind the
      keyboard/game UI (from /typely_gameplay_background_webp). Used ONLY by
      the actual gameplay screen, never by the world map or detail map. */
export const gameplayBackgrounds: string[] = [
  "/typely_gameplay_background_webp/gameplaybg-01-crystal-portal.webp",
  "/typely_gameplay_background_webp/gameplaybg-02-garden-library.webp",
  "/typely_gameplay_background_webp/gameplaybg-03-frozen-clockwork.webp",
  "/typely_gameplay_background_webp/gameplaybg-04-autumn-artist.webp",
  "/typely_gameplay_background_webp/gameplaybg-05-jungle-ruins.webp",
  "/typely_gameplay_background_webp/gameplaybg-06-candyland.webp",
  "/typely_gameplay_background_webp/gameplaybg-07-desert-canyon.webp",
  "/typely_gameplay_background_webp/gameplaybg-08-rainbow-playground.webp",
  "/typely_gameplay_background_webp/gameplaybg-09-alchemy-lab.webp",
  "/typely_gameplay_background_webp/gameplaybg-10-lagoon.webp",
];
