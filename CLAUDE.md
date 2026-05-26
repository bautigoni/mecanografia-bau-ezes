# CLAUDE.md

## 1. Project Overview

EduTic is a gamified typing and digital literacy learning app for primary school students.

The product teaches students to locate keys, type letters and words, use the spacebar and backspace, improve precision and speed, and progress through magical worlds and levels.

Core visual direction:

- Magical floating islands.
- Dreamy pastel sky worlds.
- Premium kid-friendly educational product.
- Soft 3D fantasy game feeling.
- Clean glassmorphism UI.
- Minimal interfaces that keep the artwork visible.

## 2. Visual Design System

### Color Palette

- Sky blue: `#9fc8ff`, `#cfeeff`
- Deep EduTic navy: `#17355f`, `#153b78`
- Turquoise: `#22c7b8`, `#54e8c6`
- Mint: `#5be8ba`
- Electric blue: `#536bff`, `#3159e8`
- Purple: `#7c71ff`, `#9b7cff`, `#5932d4`
- Soft pink: `#ff9fca`
- Glass white: `rgba(255, 255, 255, 0.55)` to `rgba(255, 255, 255, 0.84)`

### Gradients

- Primary action: `linear-gradient(90deg, #54e8c6, #25c8df, #536bff)`
- Magical accent: `linear-gradient(145deg, #5be8ba, #607bff, #ff9fca)`
- Dashboard background: soft radial turquoise and purple highlights over pale sky.

### Border Radius

- Small controls: `14px` to `18px`
- Pills and buttons: `18px` to `24px`
- Glass cards and panels: `24px` to `36px`
- Circular controls: `999px`

### Spacing Rules

- Student screens should feel airy, with large open sky areas.
- Do not place dense UI over important art.
- Keep menu controls near corners and away from islands and mascots.
- Use consistent gaps: `8px`, `12px`, `16px`, `24px`, `32px`.

### Shadows

- Use soft colorful depth, not harsh black shadows.
- Island shadows should use layered `drop-shadow` plus a blurred oval shadow underneath.
- Glass panels use large soft shadows such as `0 24px 60px rgba(54, 86, 134, 0.2)`.
- Buttons can glow softly on hover.

### Typography

- Use rounded, friendly, bold typography.
- Current fallback is system UI, but future improvements can add Nunito, Baloo 2, Fredoka, or Quicksand.
- Headings should be bold, warm, and readable.
- Student UI text should be short and clear.
- Admin UI text can be denser but must remain polished.

### Glass / Soft UI Usage

- Use glassmorphism only for functional overlays: login card, menus, level panels, bottom instruction panels, dashboard cards.
- Avoid putting the full background image inside a framed card.
- Avoid opaque blocks on student screens.
- Glass surfaces should use blur, translucent white, subtle gradients, and white borders.

### Animation Style

- Motion should be soft and purposeful.
- Use gentle floating loops for mascots and islands.
- Hover should add slight lift, glow, and scale.
- Navigation should fade/zoom smoothly.
- Avoid abrupt jumps or fast flashes.
- Respect `prefers-reduced-motion`.

### Icon Style

- Use rounded, friendly icons.
- `lucide-react` is acceptable for UI icons.
- Icons should be simple, clear, and softly colored.
- Avoid cluttering student screens with too many icons.

### Background Usage

- Student scenes must be full-screen and immersive.
- Use the real sky and island assets from `public/assets/edutic-art`.
- Do not create fake islands or mascots with CSS.
- For full-scene island detail images, use a blurred cover duplicate behind a contained foreground image when the full artwork must remain visible.

### Islands

- Display islands as image assets only.
- Preserve aspect ratio.
- Use percentage or viewport-based absolute positioning.
- Islands should feel naturally placed, not rigidly aligned.
- Add soft shadows and hover glow to make them feel clickable.

### Characters / Mascots

- Use mascot PNG assets only.
- Do not crop, stretch, recolor, or place white boxes behind mascots.
- Mascots should frame scenes from the bottom corners or near relevant level nodes.
- Keep mascot animation gentle.

## 3. UI / UX Rules

- Keep interfaces minimal.
- Preserve full background visibility whenever possible.
- Avoid ugly top bars on student-facing screens.
- Prefer immersive layouts with small floating controls.
- Use smooth transitions for hover, click, and navigation.
- Every clickable element must feel interactive.
- No abrupt layout changes.
- Student UI should be playful but clean.
- Admin and teacher panels should be modern and aesthetic, not plain HTML tables.
- Do not leave decorative buttons without behavior.
- Do not show placeholder gameplay when a real interaction is expected.

## 4. Project Structure

- `src/App.tsx`: app routes and protected route composition.
- `src/main.tsx`: React entry point.
- `src/components/auth`: reusable login components.
- `src/components/common`: shared primitives such as buttons, brand, and toast.
- `src/components/layout`: shared navigation components.
- `src/data`: seed data, worlds, and activities.
- `src/hooks`: app hooks such as auth.
- `src/pages`: route-level screens.
- `src/routes`: route protection.
- `src/styles`: global visual system and screen CSS.
- `src/utils`: asset map and localStorage helpers.
- `public/assets/edutic-art`: copied web-safe image assets used by the app.
- `Images`: original source images. Do not modify these files.

## 5. Components

- `LoginCard`: polished glassmorphism login form.
- `RoleSelector`: role pill grid for Admin general, Admin de sede, Profesor, and Alumno.
- `GlassInput`: soft rounded input with icon support.
- `AnimatedButton`: premium login/demo action button.
- `Button`: shared action button for panels and pages.
- `Toast`: lightweight feedback message.
- `TopNav`: shared nav fallback for non-world screens.
- `ProtectedRoute`: role-based route guard.
- Page components:
  - `WorldsPage`: student world selection scene.
  - `IslandDetailPage`: world map and level selection.
  - `GameplayPage`: playable keyboard activities.
  - `RewardsPage`: student rewards.
  - `AccountPage`: student account.
  - `AdminGeneralPage`: global admin dashboard.
  - `SiteAdminPage`: school/site admin dashboard.
  - `TeacherPage`: teacher dashboard.

## 6. Future Extension Notes

- Add more worlds and expand `src/data/worlds.ts`.
- Add more level types and mechanics in `src/data/activities.ts`.
- Improve gameplay with timing, adaptive difficulty, and richer feedback.
- Add sound effects, voice prompts, and background music with accessible toggles.
- Expand badge and reward progression.
- Add richer role-based dashboards.
- Add teacher analytics without exposing them to students.
- Add backend persistence when moving beyond demo/localStorage.
- Improve page transitions with a dedicated animation layer if the app grows.
- Add a rounded display font such as Nunito, Fredoka, Baloo 2, or Quicksand.

## Playable Gameplay Rules

- Do not modify any file inside `Images`. It contains untouched originals.
- Use only the copied public assets under `public/assets/`.
- Keep student UI immersive and minimal — no dense forms, no admin look.
- Gameplay must be real, keyboard-driven, and never a placeholder.
- Every island must have exactly 6 playable levels.
- Difficulty increases by world:
  - World 1, blue island (`island1`): letters only.
  - World 2, science/potion island (`island2`): words and short phrases.
  - World 3, library/book island (`island3`): Spanish with uppercase, tildes, ñ, ¿ ? ¡ !.
  - World 4, pink/tree island (`island4`): advanced symbols and precision (`@`, `.`, `,`, `:`, `;`, `_`, `-`, mixed punctuation, emails).
- Spanish text must be supported correctly: accents (á é í ó ú), ñ, uppercase, and the inverted signs `¿` and `¡`.
- Each island level node must open its exact matching activity by ID (`<worldId>-l<level>`).
- Progress is persisted in `localStorage` under `edutic_progress_v1`. Completing a level unlocks the next.
- Curriculum lives in `src/data/activities.ts` (24 activities total). Level → activity mapping is built in `src/data/worlds.ts` from `activitiesByWorld`. Progress logic lives in `src/utils/progress.ts`.

## Non-Negotiables

- Do not modify original images inside `Images`.
- Do not draw islands or mascots with CSS.
- Do not put background art inside bordered frames.
- Do not leave white boxes behind transparent assets.
- Do not ship dead buttons.
- Do not make student screens look like admin dashboards.
- Do not show placeholder or demo gameplay — every level must be a real, keyboard-driven activity.
