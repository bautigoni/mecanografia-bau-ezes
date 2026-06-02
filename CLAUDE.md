# CLAUDE.md

## 1. Project Overview

**TYPELY** (previously codenamed *EduTic*) is a gamified typing and digital
literacy learning app for primary school students. Spanish-first
(Latin-American Spanish), keyboard-driven, real activities — no placeholder
gameplay.

The product teaches students to locate keys, type letters and words, use
the spacebar, Shift, Backspace, tildes and the ñ, and to progress through
four magical islands of increasing difficulty.

Core visual direction:

- Magical floating islands in a dreamy pastel sky.
- Premium, kid-friendly educational product — playful but never childish.
- Soft 3D fantasy game feeling — bright art, soft shadows.
- Clean glassmorphism UI: translucent cards over the immersive art.
- Minimal interfaces that keep the artwork visible at all times.

## 2. Brand & Naming

- **Product name:** TYPELY (uppercase wordmark).
- Internal identifiers like `EduTicUser`, the localStorage prefix `edutic_*`
  and the npm `name` are kept for backward compatibility — only **user-facing
  strings** read "TYPELY".

## 3. Visual Design System

### Typography
- Loaded from Google Fonts in `index.html`:
  - **Fredoka** (500/600/700) — display font for headings, key labels,
    button text, brand wordmark.
  - **Nunito** (600/700/800/900) — body font, inputs, paragraphs.
- Exposed via CSS variables in `src/styles/global.css`:
  - `--font-body: "Nunito", "Quicksand", Inter, system-ui, …`
  - `--font-display: "Fredoka", "Baloo 2", "Nunito", ui-rounded, …`
- Headings + emphasis bind to `--font-display` via a typography pass at the
  bottom of `global.css`.

### Color palette
- Sky blue: `#9fc8ff`, `#cfeeff`
- Deep navy: `#17355f`, `#153b78`
- Turquoise / mint: `#22c7b8`, `#54e8c6`, `#5be8ba`
- Electric blue / violet: `#536bff`, `#3159e8`, `#7c71ff`, `#9b7cff`, `#5932d4`
- Soft pink: `#ff9fca`
- Star/accent gold: `#facc15`, `#ffd552`
- Glass white: `rgba(255, 255, 255, 0.55)` → `rgba(255, 255, 255, 0.92)`

### Gradients
- Primary action / target: `linear-gradient(135deg, #54e8c6, #25c8df, #536bff)`
  (often animated via `targetShimmer`).
- Magical accent / completion: `linear-gradient(145deg, #5be8ba, #607bff, #ff9fca)`.
- Heading shimmer: `linear-gradient(90deg, #5932d4, #25c8df, #5932d4)` with
  background-position animation.

### Radius
- Small controls: `14–18px`
- Pills and buttons: `18–24px`
- Glass cards: `24–36px`
- Circular: `999px`

### Shadows
- Soft colorful depth, never harsh black.
- Glass panels: `0 24px 60px rgba(54, 86, 134, 0.2)`.
- Buttons can glow softly on hover.

### Animation
- Soft and purposeful. Mascots and islands use gentle floating loops.
- Page entries fade/zoom.
- Magical island entrance (`scene-full-image`) with zoom + flash + staggered
  node pop + ship drop. Honours `prefers-reduced-motion: reduce`.

### Keyboard
- Five rows in `GameplayPage.tsx`: `num`, `top`, `home`, `bot`, `mod`.
- Each row has its own gradient palette (gold / pink / mint / violet /
  ice-blue) so kids can scan home-row position by colour.
- Per-key hover lift, diagonal shine sweep (`::after`), press-pop animation.
- Assisted-mode target: shimmering gradient + pulse, drawn from the
  per-character `expectedKey` derived in `keyCapFor()`.

## 4. Gameplay Curriculum (24 activities, 6 per island)

Defined in `src/data/activities.ts` as four arrays of 6 `Activity` records
each. Each activity carries `worldId`, `levelNumber`, `inputType`
(`letter | word | phrase | symbol | correction`), `mode`
(`assisted | independent`), optional `requiresShift` / `requiresAccent`,
and a `targets[]` array of strings to practice.

- **World 1 — Bosque de teclas (`island1`):** letters only. Home row, vocals,
  upper row, lower row, mixed alphabet, velocidad.
- **World 2 — Isla de palabras (`island2`):** 3- to 6-letter words,
  two-word phrases, Backspace correction.
- **World 3 — Laboratorio (`island3`):** mayúsculas con Shift, ñ, tildes,
  palabras con tilde, frases con ¿ ?, frases con ¡ !.
- **World 4 — Isla del código (`island4`):** punctuation `. , : ; - _`,
  símbolos con Shift (`@ ¿ ¡ ! ?`), correos electrónicos, frases con coma,
  preguntas reales, corrección final.

Helpers:
- `getActivityById(id)` — fallback to the first activity if missing.
- `activitiesByWorld[worldId]` — array per world for navigation between levels.

### 4b. Digital-skills category (scaffold)

The product can host more than typing. `src/data/digitalSkills.ts` defines a
parallel `SkillChallenge` model (`category: "digitalSkills"`) covering:

- **Mouse:** leftClick, rightClick, doubleClick, dragAndDrop, scroll.
- **Touchpad:** twoFingerScroll.
- **Windows:** open, close, minimize, maximize.
- **Tabs:** open, close, switch.
- **Shortcuts:** Ctrl+C, Ctrl+V, Ctrl+T, Ctrl+W, Ctrl+Tab.
- **Text editing:** selectText, copyPaste.
- **UI literacy:** spot the close / back / menu / settings buttons.

The catalog is seeded with 24 starter challenges. A reusable
`SkillChallengeShell` component (`src/components/digitalSkills/`) renders
the pastel chrome (header, instruction, feedback, metrics) so future mini
simulators (mock desktop, mock browser) can plug in via the `children`
slot. Nothing is wired into routes yet — this is foundation only.

## 5. Progress Persistence

`src/utils/progress.ts` manages a single localStorage key:
`edutic_progress_v1` → `Record<WorldKey, Record<levelNumber, LevelProgress>>`.

- `markLevelComplete(worldId, level, accuracy, attempts)` — called once at
  end of `GameplayPage`.
- `levelState(progress, worldId, level)` → `"Completado" | "Actual" | "Bloqueado"`.
- `getCurrentLevelNumber(progress, worldId)` — first incomplete level.
- `resetProgress()` — for QA / testing.
- `worlds.ts` builds `World.levels[]` on every render by combining
  `activitiesByWorld[worldId]` with the current progress snapshot — so the
  island map reflects unlocks live.

## 6. Navigation Flow

- `/` → `/login` (LoginPage).
- `/mundos` → `WorldsPage` (4 floating islands, click to enter).
- `/worlds/:islandId` → `IslandDetailPage` (6 platform bubbles colored by
  state, current-level ship, level detail panel).
- `/gameplay/:activityId` → `GameplayPage` (target + keyboard + robots +
  completion popup).
- `/logros`, `/mi-cuenta`, `/admin-general`, `/admin-sede`, `/profesor` —
  protected per role.

The island detail page sets `sessionStorage.edutic.lastIslandSlug = islandId`
before navigating into a level, and the completion popup navigates back to
`/worlds/${activity.worldId}` (matches `islandId` directly).

## 7. Project Structure

- `src/App.tsx` — routes + protected route composition.
- `src/main.tsx` — React entry.
- `src/components/auth/` — `LoginCard`, `GlassInput`, `RoleSelector`,
  `AnimatedButton`.
- `src/components/common/` — `Brand` (TYPELY wordmark), `Button`, `Toast`.
- `src/components/layout/TopNav.tsx` — legacy top-nav (kept; the active
  student UI uses the floating hamburger bubble on `WorldsPage`).
- `src/data/`
  - `activities.ts` — the 24-activity typing curriculum.
  - `worlds.ts` — per-island metadata + per-island level coordinates +
    dynamic level state. The level-map is rendered inside a 16:9
    `island-stage__frame` so `%` positions land on the painted platforms.
  - `digitalSkills.ts` — `SkillChallenge` model + seed catalogue for the
    future mouse / touchpad / windows / tabs / shortcuts curriculum.
  - `seed.ts` — demo users + classes.
- `src/components/digitalSkills/` — `SkillChallengeShell` (pastel chrome
  for the future mini simulator).
- `src/hooks/useAuth.tsx` — auth context + localStorage user.
- `src/pages/`
  - `LoginPage` — polished glass card with TYPELY brand, halo and
    shimmering wordmark.
  - `WorldsPage` — floating islands scattered around the sky + hamburger
    bubble.
  - `IslandDetailPage` — island art + 6 platform bubbles + ship over
    current level + level detail panel.
  - `GameplayPage` — playable keyboard activity.
  - `RewardsPage`, `AccountPage`, `AdminGeneralPage`, `SiteAdminPage`,
    `TeacherPage`.
- `src/routes/ProtectedRoute.tsx` — role-based guard.
- `src/styles/global.css` — all visual system + page CSS (single file).
- `src/utils/`
  - `assets.ts` — public-URL map for every PNG.
  - `progress.ts` — per-island progress.
  - `storage.ts` — auth, demo users, helper IDs.
- `public/assets/edutic-art/` — copied web-safe image assets used by the app.
- `public/assets/edutic-art/spaceships/` — `ship-{front,back,left,right,diagonal-{left,right}}.png`
  processed from `Images/nave-*.png`.
- `Images/` — **original** source images. Do not modify.
- `Images-new/` — newer robot art delivered by the user (`robot-{salta,
  saluda,compu,default,caja}.png`) plus the processing scripts
  (`process_mecano.py`, `process_ships.py`).
- `public/favicon.ico` + `public/favicon-256.png` — generated by
  `process_mecano.py` from the head of `robot-default.png`.

## 8. Asset Pipeline

The original PNGs in `Images/` and `Images-new/` are **never** modified. Web
assets are produced into `public/assets/edutic-art/` by the Python helpers:

- `Images-new/process_mecano.py` — verifies alpha, trims transparent
  padding, downscales to a 1024px longest edge, writes:
  - `mascot-jump.png`   (from `robot-salta.png`)
  - `mascot-proud.png`  (from `robot-default.png`)
  - `mascot-laptop.png` (from `robot-compu.png`)
  - `mascot-wave.png`   (from `robot-saluda.png`)
  - `mascot-natural.png` (from `robot-caja.png`)
  - + favicon multi-size `.ico` and `favicon-256.png`.
- `Images-new/process_ships.py` — same pipeline, capped at 700px, produces
  the six `ship-*.png` files from `nave-*.png`.

Run after dropping new source art:
```
python Images-new/process_mecano.py
python Images-new/process_ships.py
```

## 9. Mascots — Where They Appear

- **LoginPage:** large flanking robots, female wave (left) + male wave
  (right), sized `clamp(28rem, 70vh, 52rem)`. Decorative.
- **WorldsPage:** smaller corner mascots, female laptop (left) + male
  proud (right) — kept inset (`max-width: 18vw`) so islands don't collide.
- **IslandDetailPage:** *no* robots — only the ship pointing at the
  current level. Keeps the island art readable.
- **GameplayPage:** two large flanking robots with motivational speech
  bubbles. Phrase pools rotate per target; switch to an "error" tone when
  accuracy drops below 60% with ≥1 attempt. Hidden under 980px viewports.

## 10. Gameplay Screen — Behaviour Notes

- Background: `assets.gameplayBg` (a painted scene, not the sky).
- `gameplay-shell` is locked into a 3-row grid (`minmax(20rem, 30vh) auto
  minmax(7rem, auto)`) with `overflow: hidden` so the keyboard, bg, and
  robots never shift when the kid types.
- Adaptive `target-card` variants: `letter`, `word`, `phrase`, `symbol`.
  Phrases render in a wide pill with a single horizontal line that scrolls
  internally — never wraps to a new row.
- `typed-preview` shows what the student is typing in big Fredoka type.
  Single horizontal line; auto-scrolls to the right via a `ref` so the
  caret stays visible.
- Combo-hint chip appears next to the target for World 3 (accents) and
  World 4 (symbols) — driven by `comboFor(expectedChar)`:
  - Shift combos: `! ? @ # $ % & * ( ) _ + : ; ¿ ¡ " < >` and uppercase
    letters.
  - Accent combos: `á é í ó ú ü` (lowercase) → `´ + vowel`; uppercase
    accented vowels → `´ + Shift + A` (3-step).
- Level complete → modal popup with sparkles, bouncing trophy, shimmering
  title, 3-star rating, two CTAs:
  - **Reintentar** (resets the level state).
  - **Volver a la isla** (`navigate('/worlds/' + activity.worldId)`). No
    auto-advance — students must re-pick the next level deliberately.

## 11. Island Detail — Behaviour Notes

- The yellow polyline (`.magic-path`) is **removed**. The painted stone
  path in the island artwork is the visual guide.
- Level bubbles sit directly on the painted platforms (no synthetic
  pedestal). Color = state:
  - **Green** = `Completado` (3 filled stars)
  - **Violet** = `Actual` (3 empty stars — earned only on completion)
  - **Grey** = `Bloqueado` (lock icon, 3 empty stars)
- `World.levelPositions` in `src/data/worlds.ts` are not generic layout
  points. They represent the **visual center of each painted platform** in
  the island background. When adjusting these values, align the center of
  `.level-node__platform` to the platform art, not to the glowing path,
  surrounding terrain, or the full node including the rating stars.
- `.level-node` uses `left/top` as the platform center. The platform itself
  is absolutely centered inside the node; the 3-star rating is positioned
  underneath and must not affect centering. Keep this invariant when changing
  level button CSS.
- Every island currently has exactly 6 playable levels. Some island
  background images may contain extra painted platforms. Those are part of
  the artwork and should remain decorative unless the curriculum is expanded
  deliberately. Do **not** edit the original images to remove them.
- The ship is a supporting marker and sits behind level nodes (`level-ship`
  below `.level-node` in z-index) so it never hides level numbers.
- Ship asset above the current level is picked by `getShipAsset(from, to)`
  based on the vector to the next level (front/back/left/right/diagonal).
- Magical entrance: zoom-in on the island image + radial flash + staggered
  `nodePop` on the 6 platform bubbles + ship parachute-in.

## 12. Login Card — Behaviour Notes

- New `login-card__halo` — multi-color blur drifts behind the card.
- Brand pill: rounded chip with a shimmering gradient mark (mint→cyan→violet)
  + gradient-text "TYPELY" wordmark in Fredoka.
- Heading "Bienvenido a TYPELY" uses the heading-shimmer gradient.
- Sparkle pinned above the brand pill (`sparkleSpin`).

## 13. Deployment

Containerised behind Nginx, reverse-proxied by Caddy. Files in repo root:

- **Dockerfile** — multi-stage `node:22-alpine` build → `nginx:alpine`
  runtime. Runs `npm ci && npm run build` (= `tsc --noEmit && vite build`),
  copies `/app/dist` to `/usr/share/nginx/html`.
- **nginx.conf** — SPA fallback (`try_files $uri $uri/ /index.html`),
  long-cache on `/assets/*`, no-store on `index.html`, gzip on.
- **docker-compose.yml** — service `mecanografia`, container name
  `mecanografia`, `restart: unless-stopped`, exposes only
  `127.0.0.1:3005:80` (no public bind).
- **.dockerignore** — excludes `node_modules`, `dist`, `.env`,
  `.git`, logs, docker files, `Images/`, `Images-new/`, `Skills/`,
  `.claude/`, and docs.
- **DEPLOY.md** — Oracle VPS playbook: clone into
  `/opt/apps/mecanografia`, `docker compose up -d --build`,
  `curl -I http://127.0.0.1:3005` smoke test, the Caddy block for
  `mecanografia.bauhub.online`, `caddy validate` + reload, the
  `git pull && docker compose up -d --build` update flow, and a rollback
  recipe.

## 14. Playable Gameplay Rules (non-negotiable)

- Do not modify any file inside `Images/` or `Images-new/` — they are
  untouched originals.
- Use only the copied public assets under `public/assets/`.
- Keep student UI immersive and minimal — no dense forms, no admin look.
- Gameplay must be real and keyboard-driven, never placeholder.
- Level count is per-island, not fixed (see §17). It is driven by the number
  of `Activity` records for that world in `src/data/activities.ts` — NOT by the
  positions array. To add a level you must add BOTH a new `Activity` and a
  matching coordinate. Current counts: island1 = 7, island2 = 6, island3 = 7,
  island4 = 6, island5 = 7, island6–island15 = up to 8.
- If the background art shows more painted platforms than the curriculum has
  levels, keep the extra platform as decoration. Do not add fake levels to
  match the art unless the curriculum is intentionally expanded.
- Level node positions live in `src/data/levelPositions.ts` (`islandLevelLayouts`,
  re-exported through `src/data/worlds.ts`) as platform-center % coordinates.
  Do not compensate for bad placement with random CSS offsets on individual
  numbers — use the dev editor (§17) instead.
- Difficulty increases by world (see §4).
- Spanish must be supported correctly: tildes (á é í ó ú), ñ, mayúsculas,
  and inverted signs `¿` `¡`.
- Each island level node must open its exact matching activity by ID
  (`<worldId>-l<level>` for worlds 2/3/4; legacy IDs for world 1:
  `letter-a1…backspace-a1`).
- Progress persists in `localStorage.edutic_progress_v1`. Completing a
  level unlocks the next.
- Curriculum lives in `src/data/activities.ts`. Level ↔ activity mapping
  is built in `src/data/worlds.ts` from `activitiesByWorld`. Progress
  logic lives in `src/utils/progress.ts`.

## 15. Non-Negotiables

- Do not modify original images inside `Images/`.
- Do not draw islands or mascots with CSS.
- Do not put background art inside bordered frames.
- Do not leave white boxes behind transparent assets.
- Do not ship dead buttons.
- Do not make student screens look like admin dashboards.
- Do not show placeholder or demo gameplay — every level must be a real,
  keyboard-driven activity.
- Do not bake secrets into the Docker image — `.env*` is excluded by
  `.dockerignore`.

## 16. Future Extension Notes

- Add sound effects and voice prompts (TTS already used for "Escuchar
  consigna" via the Web Speech API).
- Expand badge / reward progression beyond the current 3-star per-level model.
- Add teacher analytics without exposing them to students.
- Move beyond localStorage to a real backend when the app leaves demo mode.
- Add a per-level "best time" leaderboard alongside accuracy.
- Improve i18n: today copy is Argentinian Spanish — add neutral Spanish
  variant if needed for other markets.

## 17. Recent Changes (2026-06-01)

### 17a. Roles, auth & security
- **Demo mode is student-only.** `DEMO_STUDENT` (role `alumno`) in
  `src/data/seed.ts`; `demoLogin()` in `src/utils/storage.ts` takes no role and
  ALWAYS returns it (never the superadmin). "Entrar en modo demo" → `/mundos`.
  Hard rule: demo can never reach an admin/teacher surface.
- **Google login matches by normalised email.** `normalizeEmail()`
  (trim + lowercase) is used on write (`createSedeAdmin`/`updateSedeAdmin`) and
  lookup (`findUserByEmail`/`loginByGoogleEmail`) so the same Gmail resolves to
  the same account with no duplicates. Unknown email → friendly Spanish error.
- **Temporary-password forced change.** Sede admins are created / reset with a
  temp password and `mustChangePassword`/`temporaryPassword` flags
  (`resetUserPassword`, `setUserPassword`). On login `ProtectedRoute` redirects
  to `/cambiar-contrasena` (`src/pages/ChangePasswordPage.tsx`) until a new
  password is set. Google sign-in (passwordless) bypasses this. The current
  password is never shown — only the new temp value, once.
- `authenticateAny` now lets staff (superadmin/admin-general/admin-sede/
  profesor) sign in via the form; students (`alumno`) and deactivated accounts
  are blocked. Logout button ("Cerrar sesión") lives in the dashboard sidebar
  footer (`DashboardShell`).

### 17b. Superadmin dashboard (`AdminGeneralPage`)
- Manages ONLY sedes + sede admins. Removed the "Coordinación TIC" field.
- `Site` gained `photo?` (base64 data URL) + `active?`. Sede cards show a real
  uploaded school photo (resize helper `src/utils/image.ts`) with a soft
  placeholder fallback — never island art.
- Sede admins: create (email REQUIRED), edit (name/email/sede/active), reset
  password, and **delete** with a confirmation dialog (`deleteSedeAdmin`).
- Smaller mascot (sidebar only — the hero/top robot was removed from all three
  dashboards), compact buttons, scroll-safe modals (`max-height:88vh;
  overflow-y:auto`). `Toast` already auto-dismisses, caps at 3, de-dupes.

### 17c. Island map UI (`IslandDetailPage`)
- Positions extracted to `src/data/levelPositions.ts` (single source of truth).
- The big `.island-title-panel` and right-side `.level-detail-panel` were
  replaced by a compact floating header (`.island-hud`, top-centre) and a small
  popover (`.level-popover`) anchored BESIDE the selected node (opens right for
  left-half nodes, left for right-half, vertically clamped) so it never covers
  multiple level nodes. Selected node keeps a glowing ring. The map stays the
  focus. Keep the Typely pastel/glass identity.
- **Dev-only level position editor**: gated by `import.meta.env.DEV`
  (`src/components/dev/LevelPositionEditor.tsx`). Enable via `?editor=1` or the
  "Editar niveles" toggle. Drag markers, 10% grid + crosshair, click-to-copy a
  coordinate, "Copiar arreglo" pastes straight into `levelPositions.ts`. Fully
  stripped from production/student builds.
