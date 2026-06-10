# AGENTS.md

> **`CLAUDE.md` is the single source of truth** for this project's architecture,
> structure, design system and behaviour. Read it first. This file is a short
> index so any agent (Codex, Cursor, OpenCode, etc.) lands on the same rules.

## What this project is

**TYPELY** (codename *EduTic*) — a gamified, Spanish-first typing & digital
literacy app for primary school kids. Stack: Vite 7 + React 19 + TypeScript +
Tailwind 4 (frontend) and Fastify + Drizzle + Postgres 16 (backend), shipped as
three Docker containers behind Caddy. Internal ids stay `edutic_*` / `island1..15`
for backward compat; only user-facing strings say "TYPELY".

## Where the rules live

- **`CLAUDE.md`** — full guide: architecture, roles/auth, visual + responsive
  systems, curriculum, project structure, asset pipeline, deployment, skills.
- **`ENGINEERING_RULES.md`** — general engineering rules (small reversible
  changes, build before done, RBAC, secrets, deployment safety, etc.).
- **`.cursor/rules/*.mdc`** — the same rules condensed and always-applied
  (do-not-touch, engineering-principles, layout-and-assets, rbac-and-auth,
  secrets-and-deployment, ui-and-product-identity, responsive-design).
- **`dbnew.md`** — backend implementation log. **`DEPLOY.md`** — ops runbook.
- **`Skills/`** — `skill.md` (EduTic design spec) and `frontend-design/SKILL.md`.

## Branching (read before you commit)

**Work on `dev`, never commit to `master`.** `master` is the host/production
branch (deployed to `mecanografia.bauhub.online`); there is no `main` — "main"
means `master`. All development lands on `dev`; `master` only changes through a
reviewed **pull request from `dev`**, and only when everything is ready and
`npm run build` passes. Full rules in `CLAUDE.md` §17.

## Non-negotiables (summary — see CLAUDE.md §15)

1. Never modify originals in `Images/` or `Images-new/`; use/regenerate the web
   copies in `public/assets/`.
2. Keep the TYPELY identity (pastel, playful, glassmorphism); don't draw islands
   or mascots with CSS; student UI must never look like an admin dashboard.
3. Gameplay is real and keyboard-driven, never placeholder. Spanish must be
   correct (tildes, ñ, mayúsculas, `¿` `¡`).
4. Respect RBAC: demo is always a student; lower roles never reach higher-role
   screens.
5. Secrets never go in `VITE_*`; keep them server-side. Don't break the Docker
   deploy or change the `127.0.0.1:3005`/`:3006` ports.
6. Keep the app responsive (monitors / Chromebooks / phones — see CLAUDE.md §6).
7. After any change run `npm run build`; report files changed and how to test.
8. Branch on `dev`; never commit to `master`. `master` (production/host) only
   updates via a reviewed PR from `dev` when everything is ready.
