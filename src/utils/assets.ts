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

  worldsIsland1: "/assets/processed/worlds-island1-transparent.webp",
  worldsIsland2: "/assets/processed/worlds-island2-transparent.webp",
  worldsIsland3: "/assets/processed/worlds-island3-transparent.webp",
  worldsIsland4: "/assets/processed/worlds-island4-transparent.webp",
  worldsIsland5: "/assets/edutic-art/world-island5.webp",
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

/* Expansion islands (island6 … island15).
   - `expansionIslandThumbs` → floating island art on the world-selection map
     (from /typely_islands_webp).
   - `expansionWorldBackgrounds` → zoomed scene used by the island-detail level
     map AND the gameplay background for that world (from /typely_backgrounds_webp).
   Mapped by order: index 0 → island6, … index 9 → island15. */
export const expansionIslandThumbs: string[] = [
  "/typely_islands_webp/background-island1.webp",
  "/typely_islands_webp/background-island2.webp",
  "/typely_islands_webp/background-island3.webp",
  "/typely_islands_webp/background-island4.webp",
  "/typely_islands_webp/background-island5.webp",
  "/typely_islands_webp/background-island6.webp",
  "/typely_islands_webp/background-island7.webp",
  "/typely_islands_webp/background-island8.webp",
  "/typely_islands_webp/background-island9.webp",
  "/typely_islands_webp/background-island10.webp",
];

export const expansionWorldBackgrounds: string[] = [
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
