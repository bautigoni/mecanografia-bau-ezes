# ENGINEERING_RULES.md

These are the general engineering rules every agent must follow when
working on the TYPELY / BauHub codebase. They complement the
project-specific guidance in `AGENTS.md` and `CLAUDE.md`.

## 1. Read the project structure before editing
Before making changes, inspect the relevant files, existing components,
data models, routes, styles, and docs. Do not invent architecture that
conflicts with the current project.

## 2. Work from the existing codebase
Do not rewrite entire features unless explicitly requested. Prefer small,
focused, reversible changes that preserve the current UI, routing, data
flow, and deployment.

## 3. Use the project's stack and conventions
This project uses React + Vite + TypeScript/JavaScript, CSS, Docker, and
Caddy deployment. Follow the patterns already present in the repo before
introducing new libraries or structures.

## 4. Stop and change strategy after 3 failed attempts
After 3 failed attempts, do not keep patching randomly. Clear relevant
cache if appropriate, re-read the error, inspect logs, isolate the failing
file, and try a different approach. Explain what failed and what changed.

## 5. Never touch generated or dependency files unless explicitly asked
Do not edit or commit `node_modules`, `dist`, build output, `.vite`
cache, `package-lock.json` changes unless dependencies changed
intentionally, local IDE settings, or `.claude/settings.local.json`.

## 6. Do not expose secrets
Never put private API keys in frontend variables. Anything starting with
`VITE_` is public. Backend secrets such as `RESEND_API_KEY` must stay
server-side only.

## 7. Preserve Docker deployment
After changes, ensure Docker still builds. Do not use host ports 80 or
443 inside app compose files. Keep each app's assigned port stable unless
instructed.

## 8. Verify with build/typecheck when changing code
Run the project's available checks, such as `npm run build`,
`npm run typecheck`, or `tsc --noEmit`. If a check fails, fix it before
claiming completion.

## 9. Respect role-based access
Student views are only for students. Admin views are only for admins.
Demo mode must never log in as superadmin. Never let lower roles access
higher-role screens.

## 10. Keep UI consistent with the product identity
TYPELY must keep its pastel, playful, robot, educational style. BauHub
must keep its dark futuristic ecosystem style. Do not make generic
corporate dashboards unless asked.

## 11. Make responsive and usable interfaces
All popups/modals must scroll when content exceeds viewport height.
Buttons must remain reachable. Avoid UI that covers important interactive
elements.

## 12. Keep animations smooth and purposeful
Use `animejs` / `framer-motion` only where useful. Avoid janky scroll,
teleporting elements, infinite distracting loops, or heavy animations
that hurt performance.

## 13. Use data/config instead of hardcoded layout hacks
For level positions, use percentage-based coordinate configs. Do not
hardcode random pixel positions in CSS unless unavoidable.

## 14. Be explicit about files changed
After completing work, report exactly which files changed, why they
changed, and how to test the result.

## 15. If uncertain, inspect before acting
Do not guess filenames, routes, data shapes, or deployment behavior.
Search the repo, read the relevant code, then make the smallest correct
change.

## 16. Do not break login
Before changing auth, verify manual login, Google login, logout, role
redirect, and `localStorage` / `sessionStorage` behavior.

## 17. Avoid infinite UI accumulation
Toasts, notifications, intervals, animation loops, and event listeners
must clean up properly. Max visible toasts should be limited.

## 18. Use stable asset naming
Images and icons must be referenced by clear names. Do not rename assets
randomly. If replacing icons, preserve expected filenames and status
logic.

## 19. Keep educational progression coherent
For learning apps, level difficulty must increase gradually. Do not
introduce punctuation, accents, uppercase, or complex words before they
are taught.

## 20. Never deploy blindly
Before telling the user to deploy, confirm `git status`, build success,
container status, and the correct exposed port.
