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
- **Read-only impersonation (support)** — `POST /api/admin/impersonate`
  (`api/src/routes/support.ts`) lets superadmin/admin-general/admin-sede VIEW
  another in-scope account for 30 min after a **triple check** (own password +
  exact phrase `ACCEDER EN MODO LECTURA` + legal acknowledgment). It mints an
  access token with a `readOnly` claim and NO refresh cookie (dies in 30 min);
  a global preHandler in `server.ts` rejects every mutation made with a
  `readOnly` token. Never targets a superadmin. Front: `ImpersonateModal` +
  global `ImpersonationBanner` (countdown), wired through `useAuth`
  (`startImpersonation`/`stopImpersonation`). Audited as `impersonate_start`.

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

### Login mascots — flanking robots
The two login robots are positioned inline in `LoginPage.tsx` with Tailwind
viewport units (no dedicated CSS class anymore): female left
(`bottom-[17.5vh] left-[5.5vw] max-h-[62vh]`), male right
(`bottom-[7.5vh] right-[8vw] max-h-[72vh]`). They're sized purely by height
so both scale together; the `bottom` offsets stand each robot on a painted
island. Tune those four values for placement/size. The login card is fixed
at `w-[min(32rem,92vw)]` with the original (non-fluid) typography — do NOT
reintroduce vmin-clamped fonts on the login card (it ballooned the UI and
pushed buttons off-screen on short displays).

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
  `ShortcutLevelView`, `ChangePasswordPage`, `AdminGeneralPage`,
  `TeacherPage`, `TeacherClassPage`, `TeacherStudentPage`, plus the routed
  admin-sede screens in `src/pages/admin/` (incl. `ApiInspectorPage` at
  `/admin/api` — superadmin/admin-general/admin-sede only, backed by
  `GET /api/admin/inspector`).
- `src/components/` — `auth/`, `common/` (`Brand`, `Button`, `Toast`),
  `dashboard/DashboardShell`, `dev/LevelPositionEditor`, `digitalSkills/`,
  `layout/TopNav`.
- `src/data/` — `activities.ts`, `worlds.ts`, `levelPositions.ts`,
  `digitalSkills.ts`, `seed.ts`.
- `src/hooks/useAuth.tsx` — API-aware auth provider (async, localStorage fallback).
- `src/utils/` — `api.ts` (typed API client), `assets.ts` (public-URL map),
  `progress.ts`, `storage.ts`, `image.ts`, `googleAuth.ts`,
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
- **Branch on `dev`, never commit directly to `master`.** `master` is the
  host/production branch; it only changes through a reviewed pull request from
  `dev` when everything is ready (see §17).
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

## 17. Branching & Git Workflow

The repo has two long-lived branches:

- **`dev` — all development happens here.** Branch off `dev`, commit your work to
  `dev` (or to short-lived feature branches that merge back into `dev`), and push
  `dev`. This is the default working branch for everyone — humans and agents.
- **`main` — host/production only.** Every push to `main` **auto-deploys** to
  `typely.bauhub.online` via `.github/workflows/deploy.yml`, so it must stay
  releasable at all times.

Hard rules:

1. **Never commit or push directly to `main`.** It changes *only* through a
   pull request from `dev`, and *only* when the work is finished and tested
   ("cuando esté todo listo").
2. **`dev` → `main` via Pull Request.** When everything is ready, open a PR from
   `dev` into `main`, review it, then merge. Do not fast-forward random branches
   into `main` by hand.
3. **Before opening the PR**, run `npm run build` (`tsc --noEmit && vite build`)
   plus `npx tsc -p api/tsconfig.json`, and the deploy checklist (see
   `DEPLOY.md` / §13) so `main` never breaks.
4. Keep `dev` merged up to date with `main` after each release so the two don't
   drift.
5. The legacy `master` branch is historical only — do not use it.

```bash
git checkout dev          # work happens here
# …edit, commit…
git push origin dev       # pushes to origin/dev (never to main)
# when ready for production: open a PR  dev → main  and merge it
```
