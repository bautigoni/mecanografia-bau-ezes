# CLAUDE.md

> Authoritative project guide for agents and developers. `AGENTS.md` points
> here; `ENGINEERING_RULES.md` and `.cursor/rules/*` hold the condensed rules;
> `dbnew.md` is the backend implementation log; `DEPLOY.md` is the ops runbook.

## 1. Project Overview

**TYPELY** (previously codenamed *EduTic*) is a gamified typing and digital
literacy learning app for primary school students. Spanish-first
(Latin-American Spanish), keyboard-driven, real activities — no placeholder
gameplay. Students learn to locate keys, type letters/words, use the spacebar,
Shift, Backspace, tildes and the ñ, and progress through a chain of magical
floating islands of increasing difficulty.

Core visual direction:

- Magical floating islands in a dreamy pastel sky.
- Premium, kid-friendly educational product — playful but never childish.
- Soft 3D fantasy game feeling — bright art, soft shadows.
- Clean glassmorphism UI: translucent cards over the immersive art.
- Minimal interfaces that keep the artwork visible at all times.

## 2. Brand & Naming

- **Product name:** TYPELY (uppercase wordmark).
- Internal identifiers like `EduTicUser`, the localStorage prefix `edutic_*`,
  the world ids `island1..island15`, and the npm `name: "edutic"` are kept for
  backward compatibility — only **user-facing strings** read "TYPELY". URLs,
  asset paths and localStorage keys are stable and must not be renamed.

## 3. Architecture (current)

TYPELY started frontend-only (localStorage) and now has a real backend. It runs
as **three Docker containers behind a Caddy reverse proxy** at
`typely.bauhub.online`:

| Layer | Stack | Where | Exposed |
| --- | --- | --- | --- |
| Frontend | Vite 7 + **React 19** + TypeScript + **Tailwind 4**, built to static files served by Nginx | `src/`, `Dockerfile`, `nginx.conf` | `127.0.0.1:3005` |
| API | **Fastify + Drizzle ORM** (TS, ESM) | `api/`, `Dockerfile.api` | `127.0.0.1:3006`, proxied under `/api/*` |
| Database | **Postgres 16** | `db/init/*.sql` | loopback only |

- **Hot path stays local.** The typing engine reads/writes `localStorage` so the
  game never blocks on the network. The API only receives a batched
  level-complete POST and is the source of truth for cross-device progress +
  teacher/admin dashboards.
- **Graceful fallback.** `src/utils/api.ts` + `src/hooks/useAuth.tsx` fall back
  to the localStorage user list when the API is unreachable, so demo mode and
  offline play keep working. `usingApi` is exposed so dashboards can show a
  "backend offline" state.
- See `dbnew.md` for the full backend log and `DEPLOY.md` for the 3-container
  deploy/ops runbook. The optional `server/index.mjs` is a separate invitation-
  email scaffold (NOT in compose) — don't assume it's running.

## 4. Roles & Auth

Roles: `superadmin`, `admin-sede`, `profesor`, `alumno`. After login each role
lands on its own surface via `routeForRole` (`/admin-general`, `/admin-sede`,
`/profesor`, `/mundos`).

- **Demo mode is student-only.** `demoLogin()` in `src/utils/storage.ts` always
  returns the seeded demo student and routes to `/mundos`. It can never reach an
  admin/teacher surface — this is a hard rule.
- **Staff** (superadmin/admin-sede/profesor) sign in with username/password via
  `authenticateAny`; students are blocked from the staff form path. Superadmin
  `admin`/`admin` always works via a defensive fallback.
- **Google sign-in** matches by normalised email (`normalizeEmail`, server-side
  ID-token verification against Google JWKS — never trust the client payload).
- **Temp passwords:** sede admins are created/reset with a temp password +
  `mustChangePassword`; `ProtectedRoute` forces `/cambiar-contrasena` until
  changed. Google (passwordless) bypasses it. Never display the current password.
- **RBAC** (`api/src/rbac.ts`): `canGrantRole(actor,target)` — an `admin_sede`
  can never grant `admin_sede` or higher; `canActOnSede` blocks cross-sede
  mutations. Every user-mutating endpoint calls these.

## 5. Visual Design System

### Typography
- Loaded from Google Fonts in `index.html`:
  - **Fredoka** (500/600/700) — display: headings, key labels, buttons, wordmark.
  - **Nunito** (600–900) — body, inputs, paragraphs.
- CSS variables in `src/styles/global.css`:
  `--font-display: "Fredoka", …` and `--font-body: "Nunito", …`.

### Color palette
- Sky blue `#9fc8ff` `#cfeeff`; deep navy `#17355f` `#153b78`; turquoise/mint
  `#22c7b8` `#54e8c6` `#5be8ba`; electric blue/violet `#536bff` `#3159e8`
  `#7c71ff` `#9b7cff` `#5932d4`; soft pink `#ff9fca`; gold `#facc15` `#ffd552`;
  glass white `rgba(255,255,255,0.55→0.92)`.

### Gradients / radius / shadows / animation
- Primary action gradient: `linear-gradient(135deg, #54e8c6, #25c8df, #536bff)`.
- Magical/completion: `linear-gradient(145deg, #5be8ba, #607bff, #ff9fca)`.
- Radius: small 14–18px, pills/buttons 18–24px, glass cards 24–36px, circle 999px.
- Shadows are soft and colorful, never harsh black. Glass panels:
  `0 24px 60px rgba(54,86,134,0.2)`.
- Animations are soft and purposeful; honour `prefers-reduced-motion: reduce`.

### Keyboard (GameplayPage)
- Five rows (`num`, `top`, `home`, `bot`, `mod`), each with its own gradient so
  kids can scan home-row position by colour. Per-key hover lift, shine sweep,
  press-pop. Assisted mode highlights the `expectedKey` derived in `keyCapFor()`.

## 6. Responsive System

`src/styles/global.css` is one large file (~9k lines) with the visual system +
all page CSS. Responsiveness targets three device classes:

- **Common monitors (≥1280px):** the default desktop layout.
- **Small laptops / Chromebooks (1280–1366 wide but SHORT, ~768/800 tall):** the
  real constraint is *height* — handled by the existing `@media (max-height: …)`
  blocks (720/620/560). Width layout = desktop.
- **Phones (≤768px):** handled by a single consolidated **"RESPONSIVE PASS"
  section appended at the END of `global.css`** (width-only `≤768 / ≤600 / ≤430`
  queries, placed last so they win the cascade without editing the scattered
  earlier overrides). Desktop/Chromebook are untouched by it.

Key responsive rules in that section:
- Global `overflow-x: hidden` safety ≤768px.
- **Gameplay:** the keyboard's per-key `min-width` is reduced so all rows fit a
  phone (keys shrink, stay centred); target card / status / stage go full-width;
  decorative robots hidden; compact exit button.
- **Island detail:** back/profile become icon-only, compact HUD, no collision.
- **Logros:** the 4-column reward grid collapses to 2×2.

### Login mascots — proportional flanking system
The two login robots (`.login-mascot--left/right`, `mascot-women-wave` and
`mascot-wave`) are sized **purely by height** (no `max-width` that would clip one
more than the other), so they always scale together and stay proportional. The
height tracks the space beside the centred card:

```
height: min(60vh, calc((50vw - 18rem) / 0.69));
```

- `50vw - 18rem` = horizontal room from the viewport edge to the card (card is
  `32rem` ⇒ half `16rem`, +2rem gap). `÷ 0.69` converts that target *width* to a
  *height* (the trimmed woman PNG is ~0.69 aspect). This keeps a near-constant
  gap from the card at every width; capped at `60vh` on tall screens.
- On phones (`≤720px`) the mascots switch to small bottom-corner decorations
  (`max-width` re-capped) so the square-ish art can't cover the card.
- Per-side `bottom`/`left`/`right` offsets place each robot standing on a painted
  island. Tune those clamps, not the formula, for placement.

## 7. Gameplay Curriculum

Defined in `src/data/activities.ts`. Each `Activity` carries `worldId`,
`levelNumber`, `inputType` (`letter | word | phrase | symbol | correction`),
`mode` (`assisted | independent`), optional `requiresShift` / `requiresAccent`,
and a `targets[]` array.

- There are **15 worlds** (`island1..island15`) in difficulty order. The
  **level count is per-island, NOT fixed** — it is driven by the number of
  `Activity` records for that world. To add a level you must add BOTH a new
  `Activity` AND a matching coordinate in `src/data/levelPositions.ts`.
- Difficulty rises by world: letters → words/phrases → mayúsculas, ñ, tildes,
  inverted signs `¿ ¡` → punctuation, symbols, emails, real questions, and
  beyond (digital-skills worlds).
- Helpers: `getActivityById(id)` (falls back to first), `activitiesByWorld[worldId]`.
- Level ↔ activity id mapping: `<worldId>-l<level>` for worlds 2+, legacy ids for
  world 1 (`letter-a1 … backspace-a1`).

### Digital-skills scaffold
`src/data/digitalSkills.ts` defines a parallel `SkillChallenge` model (mouse,
touchpad, windows, tabs, shortcuts, text editing, UI literacy). `SkillLevelView`
/ `ShortcutLevelView` render these; `SkillChallengeShell` provides the pastel chrome.

## 8. Progress Persistence

`src/utils/progress.ts` manages `localStorage.edutic_progress_v1` →
`Record<WorldKey, Record<levelNumber, LevelProgress>>`.

- `markLevelComplete(worldId, level, accuracy, attempts)` at end of `GameplayPage`
  (also POSTed to `/api/progress/complete` when API-backed).
- `levelState()` → `"Completado" | "Actual" | "Bloqueado"`;
  `getCurrentLevelNumber()`; `resetProgress()`.
- `src/data/worlds.ts` rebuilds `World.levels[]` each render from
  `activitiesByWorld` + the progress snapshot, so unlocks reflect live.
- World order is the single source of truth in `WORLD_PEDAGOGY_ORDER`; each world
  shows its pedagogical `displayNumber` (e.g. "M3").

## 9. Project Structure

- `src/App.tsx` — routes + protected-route composition (lazy-loads heavy pages).
- `src/pages/` — `LoginPage`, `WorldsPage`, `IslandDetailPage`, `GameplayPage`,
  `RewardsPage`, `AccountPage`, `MissionsPage`, `SkillLevelView`,
  `ShortcutLevelView`, `ChangePasswordPage`, `AdminGeneralPage`, `SiteAdminPage`,
  `TeacherPage`, `TeacherClassPage`, `TeacherStudentPage`.
- `src/components/` — `auth/`, `common/` (`Brand`, `Button`, `Toast`),
  `dashboard/DashboardShell`, `dev/LevelPositionEditor`, `digitalSkills/`,
  `layout/TopNav`.
- `src/data/` — `activities.ts`, `worlds.ts`, `levelPositions.ts`,
  `digitalSkills.ts`, `seed.ts`.
- `src/hooks/useAuth.tsx` — API-aware auth provider (async, localStorage fallback).
- `src/utils/` — `api.ts` (typed API client), `assets.ts` (public-URL map),
  `progress.ts`, `storage.ts`, `image.ts`, `googleAuth.ts`, `emailService.ts`,
  `studentStatus.ts`, `userContext.ts`.
- `src/styles/global.css` — entire visual system + page CSS + the responsive pass.
- `api/src/` — `server.ts`, `auth.ts`, `rbac.ts`, `seed.ts`, `db/{index,schema}.ts`,
  `routes/{auth,users,sedes,progress,import}.ts`.
- `db/init/` — `001_schema.sql`, `002_partitions.sql`.
- `public/assets/edutic-art/` — web-safe image copies used by the app.
- `Images/`, `Images-new/` — **original source art (never modified).**

## 10. Asset Pipeline

Originals in `Images/` and `Images-new/` are **never** modified. Web copies live
in `public/assets/edutic-art/` and are produced by the Python helpers
(`Images-new/process_mecano.py` for mascots/favicons, `process_ships.py` for
ships): verify alpha, **trim transparent padding**, downscale to a 1024px longest
edge.

- Reference assets by their stable names via `src/utils/assets.ts` — do not rename.
- The login web copies are kept trimmed (character fills the frame, no dead
  padding) so positioning is predictable — e.g. `mascot-women-wave.webp` is
  ~706×1024 (trimmed from the 1254² source). When replacing art, change the
  original and re-run the scripts; keep the web copy trimmed.
- One-off image edits may use `npx`/Node `sharp` (installed `--no-save`). Local
  asset backups live in `_backups/` (gitignored, not shipped).

## 11. Mascots — Where They Appear

- **LoginPage:** large flanking robots (female left, male right), sized by the
  proportional formula in §6. Decorative.
- **WorldsPage:** smaller corner mascots, kept inset so islands don't collide.
- **IslandDetailPage:** *no* robots — only the ship pointing at the current level.
- **GameplayPage:** two flanking robots with motivational speech bubbles (error
  tone when accuracy < 60% with ≥1 attempt). Hidden on phones.

## 12. Behaviour Notes (gameplay / island map / login)

- **Gameplay shell** is a fixed-height (`100dvh`, `overflow:hidden`) flex column
  so the keyboard/bg/robots never shift while typing. Adaptive `target-card`
  variants (`letter | word | phrase | symbol | long`); phrases scroll on a single
  line. Level complete → modal with 3-star rating + Reintentar / Volver (no auto-
  advance).
- **Island map**: level bubbles sit on the painted platforms; colour = state
  (green Completado / violet Actual / grey Bloqueado). Positions are platform-
  center % coords in `src/data/levelPositions.ts`. Compact floating HUD
  (`.island-hud`) + popover beside the selected node. **Dev-only** position editor
  (`?editor=1`, gated by `import.meta.env.DEV`, stripped from prod).
- **Login card**: glass card with halo, shimmering "TYPELY" wordmark, role-aware
  form. Card width `min(32rem, …)`.

## 13. Deployment

Containerised behind Nginx + Caddy. `Dockerfile` (frontend, multi-stage
`node:22-alpine` → `nginx:alpine`, runs `npm ci && npm run build`),
`Dockerfile.api` (API), `docker-compose.yml` (services `mecanografia`, `api`,
`db`, all loopback-bound; `db` healthcheck; `api` reads secrets from
`/run/secrets/*`). `nginx.conf` does SPA fallback. `.dockerignore` excludes
`node_modules`, `dist`, `.env*`, `secrets/*`, `Images*/`, `Skills/`, `.claude/`,
docs. Full runbook in `DEPLOY.md`.

## 14. Skills (for agents)

- `Skills/skill.md` — **EduTic Design Skill**: pixel-spec for the login card and
  visual system; match reference images, compare by screenshot.
- `Skills/frontend-design/SKILL.md` — Anthropic **frontend-design** skill
  (distinctive, production-grade UI; avoid generic AI aesthetics). A working copy
  also lives at `.claude/skills/frontend-design/` for local Claude Code use.
- `.opencode/agents/` — OpenCode subagents (not Claude Code): `flash` (simple),
  `chill` (standard logic), `pro` (architecture/infra) + the
  `enrutador-complejidad` routing skill.

## 15. Non-Negotiables

- Do not modify original images in `Images/` or `Images-new/` — use the web
  copies under `public/assets/`; regenerate copies via the Python scripts.
- Do not draw islands or mascots with CSS; no background art inside bordered
  frames; no white boxes behind transparent assets.
- Keep student UI immersive and minimal — never make it look like an admin
  dashboard. Gameplay must be real and keyboard-driven, never placeholder.
- Respect RBAC: students only on student surfaces; demo can never be superadmin;
  lower roles never reach higher-role screens.
- Never put secrets in `VITE_*` (inlined into the public bundle). Backend secrets
  (`JWT_SECRET`, `RESEND_API_KEY`, OAuth client secret) stay server-side.
- Keep Docker building; do not bind host ports 80/443 in app compose; keep the
  `127.0.0.1:3005` / `:3006` ports stable. Don't ship dead buttons.
- Spanish must be correct: tildes (á é í ó ú), ñ, mayúsculas, inverted `¿` `¡`.
- After any code change run `npm run build` (= `tsc --noEmit && vite build`); fix
  failures before claiming done. Report which files changed and how to test.

## 16. Quick Start

```bash
npm install          # frontend deps
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc --noEmit && vite build
```

Demo: the login "Entrar en modo demo" button enters as a student. Staff/admin and
the API/DB require the backend (see `DEPLOY.md`). Reset demo data by clearing the
`edutic_*` localStorage keys (listed in `README.md`).
