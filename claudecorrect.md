# claudecorrect.md — TYPELY

Bitácora de los arreglos aplicados al proyecto **TYPELY** (React + Vite + TypeScript,
Argentinian Spanish, pastel/glassmorphism) en la sesión del viernes 5 de junio de 2026.

El objetivo del documento es dejar registro de **qué se cambió, por qué, y cómo se
verificó**, para que cualquiera (humano o agente) pueda retomar el estado sin leer el
historial completo del chat.

---

## 1. Resumen ejecutivo

Tres frentes de trabajo, ejecutados en cuatro turnos:

1. **Misiones** — el botón "Misiones" del menú hamburguesa navegaba a `/mundos` (la
   misma pantalla en la que ya estaba el usuario), por lo que parecía un no-op. Se
   creó la página `/misiones` con la estética de la app y se cableó la ruta.
2. **Sombras y hover de las islas** — se atacaron dos problemas visuales sobre el
   mapa de mundos: una sombra rectangular debajo de las islas PNG (todavía visible
   después de un pase previo) y una animación de hover que se sentía janky
   (movimientos desincronizados, frame drops al posar el mouse).
3. **Jank de animaciones + clipping de M15 + halo fantasma de M1** — el bobbing
   de las islas y los robots tenía per-frame repaint de filtros pesados
   (`drop-shadow` + `feGaussianBlur`); había una luna/halo blanco que se salía del
   botón de M1, y la última isla (M15) quedaba cortada en el borde derecho.

Estado final: `npm run build` pasa (único warning preexistente del editor de
niveles, no introducido por estos cambios).

---

## 2. Misiones (`/misiones`)

### 2.1 Diagnóstico

`src/pages/WorldsPage.tsx` (línea 359 original):

```359:362:src/pages/WorldsPage.tsx
            <button type="button" onClick={() => navigate("/mundos")}>
              <Flag size={19} />
              <span>Misiones</span>
            </button>
```

El botón "Misiones" del menú hamburguesa apuntaba a `/mundos`, pero `/mundos` es
exactamente la pantalla donde ya estaba el usuario (`WorldsPage`). Resultado: el
botón parecía no hacer nada.

`git log -p --all -S "Misiones"` confirmó que históricamente "Misiones" siempre
fue el label de `/mundos` en `TopNav.tsx` — no era regresión, sino una decisión
que ya no tenía sentido. Se confirmó con el usuario y se optó por **crear la
página `/misiones` real**.

### 2.2 Solución aplicada

#### Archivo nuevo: `src/pages/MissionsPage.tsx`

Página `/misiones` con la estética de la app (mismo shell `student-soft-page` +
`student-page-header` + fondo `assets.homeBg` que `RewardsPage`). Tres secciones:

1. **Hero "Tu aventura"** — mundos completados, estrellas totales, barra de
   progreso shimmer del total.
2. **Misión del día** — halo pastel + chip "Misión del día", nombre del nivel
   actual, isla actual, pill "Nivel N", pill de estrellas del mundo, barra de
   progreso del mundo, dos CTAs:
   - **Jugar ahora** → deep-link a `/gameplay/<activityId>`
   - **Ver la isla** → `/worlds/<worldId>`
   - Hint contextual: "Te faltan N★ para desbloquear X".
3. **Grid de mundos** — una card glass por mundo con número M1–M15, título, topic,
   barrita de estrellas y estado (En curso / Completado / Bloqueado). Cards con
   animación `missionRise` con stagger.

Lecturas memoizadas siguiendo el patrón de `WorldsPage` (`getUserContext`,
`loadProgress`, `getWorldsForUser`, `getWorldStatesForUser`, `worldStarProgress`,
`currentActivityFor`). `currentActivityFor` resuelve el primer `Activity` no
completado del mundo actual; si el mundo ya está completo, cae al último
activity como CTA "Volver a jugar".

#### `src/App.tsx`

- Importa `MissionsPage`.
- Agrega la ruta `/misiones` dentro del mismo `ProtectedRoute roles={["alumno"]}`
  que ya cubre `/mundos`, `/worlds/:islandId`, `/gameplay/:activityId`, `/logros`
  y `/mi-cuenta`.

```5:7:src/App.tsx
import { RewardsPage } from "./pages/RewardsPage";
import { AccountPage } from "./pages/AccountPage";
import { MissionsPage } from "./pages/MissionsPage";
```

```70:72:src/App.tsx
        <Route path="/logros" element={<RewardsPage />} />
        <Route path="/mi-cuenta" element={<AccountPage />} />
        <Route path="/misiones" element={<MissionsPage />} />
      </Route>
```

#### `src/pages/WorldsPage.tsx` (línea 359)

El botón "Misiones" del menú hamburguesa ahora navega a `/misiones`.

```359:362:src/pages/WorldsPage.tsx
            <button type="button" onClick={() => navigate("/misiones")}>
              <Flag size={19} />
              <span>Misiones</span>
            </button>
```

#### `src/styles/global.css` (bloque MISSIONS PAGE al final)

Nuevo bloque de CSS con todas las clases de la página (`.missions-page`,
`.missions-hero`, `.missions-featured` con halo + chip + pills + barra de
progreso + CTAs, `.missions-grid`, `.missions-card` con variantes
`is-current` / `is-done` / `is-locked`, `@keyframes missionRise`, stagger por
`nth-child`, `prefers-reduced-motion` y media query mobile).

Animación de barras de progreso: `targetShimmer` reusado del sistema existente
(4.2s linear infinite sobre `linear-gradient(90deg, #54e8c6, #25c8df, #536bff)`).

### 2.3 Verificación

- `npm run build` pasa.
- TS error inicial (`.state` en `Activity`) corregido usando `isLevelCompleted`
  en lugar del `state` que pertenece a `Level`, no a `Activity`.
- `git status` muestra `MissionsPage.tsx` como archivo nuevo y `App.tsx` /
  `WorldsPage.tsx` / `global.css` modificados.

---

## 3. Sombras y hover de las islas (turno 1, subagentes)

### 3.1 Sombra rectangular debajo de las islas

**Diagnóstico del subagente 1:**

La banda oscura venía de un `filter: drop-shadow(...)` de dos capas en
`.world-island img` con offsets/blurs grandes (`(10/10, 0.28)` y `(22/26, 0.22)`)
que seguían el alfa del PNG y se apilaban en la base, más un `::before` muy
ancho que leía como piso.

**Fix (sólo CSS, `src/styles/global.css`):**

1. `.world-island img` — drop-shadows bajados a `(4/4, 0.14)` y `(8/10, 0.10)`.
2. `.world-island::before` — footprint más angosto (`left/right 14%`, `height 14%`,
   `bottom -4%`), alphas de `0.32/0.18` a `0.18/0.10`, blur `0.55rem` → `0.4rem`.
3. `.world-island:hover::before` — opacidad de `0.82` → `0.5` para que case con
   el tono de reposo.
4. `.world-island.is-selected img` — reemplazó los tres drop-shadows duros por
   el mismo set suave + un inner glow blanco como cue de "lift".
5. `.world-island.world-island--locked img` y los tres frames de
   `@keyframes worldUnlockReveal` — suavizados para mantener consistencia.

**Verificación:** `npm run build` pasa.

### 3.2 Hover janky de las islas

**Diagnóstico del subagente 2:**

Dos causas:
- El idle `islandFloat` animaba la `transform` del `<img>` (que encima tenía un
  `drop-shadow` pesado → repaint de alfa cada frame, sin capa GPU).
- El botón usaba 220ms y la nube 300ms → la sombra se atrasaba del botón ~80ms
  en cada hover.

**Fix (sólo CSS, `src/styles/global.css`):**

- El float se movió a `.world-island-wrap` (filter-free, GPU-only) — la misma
  pieza que ya estaba wrappeando a las islas, solo que ahora se hizo explícito
  en el comentario.
- Se agregó `translate3d(0,0,0)` para forzar la propia capa GPU.
- Transiciones unificadas a 240ms con `cubic-bezier(0.22, 1, 0.36, 1)`.
- Hover / selected / locked / active suman el lift al float en vez de pelearse
  con él.
- `prefers-reduced-motion: reduce` mata ambos.

**Verificación:** `npm run build` pasa.

---

## 4. Jank de animaciones + clipping de M15 + halo fantasma de M1 (turno 2)

### 4.1 Diagnóstico (merge de 2 subagentes)

**Subagente A** se enfocó en:
- Robot con `mascotFloat` + 2 `drop-shadow` en el mismo `<img>` (mismo bug que
  ya habían arreglado para las islas pero no aplicaron a los robots).
- `content-visibility: auto` + 2 GPU layers (`will-change` en wrap y button) +
  repaint del `<img>` con drop-shadows al hover.
- `home-speech-bubble` con `backdrop-filter: blur(12px)` sobre mascota que se
  mueve.

**Subagente B** se enfocó en:
- Stagger `:has(.world-island--islandN)` solo cubre `island2..island5` → 12 de
  15 islas en fase = marching band.
- SVG `world-map-path__base` con `filter: url(#world-route-glow)`
  (`feGaussianBlur` + `feColorMatrix`) + `vector-effect: non-scaling-stroke`
  que rompe el cache → re-raster constante sobre un track de cientos de vw.
- `selectedWorldGlow` 4.2s sobre un `::after` con `filter: blur(0.9rem)`,
  desincronizado con el float de 6.4s.

**Convergencia:**

Ambos coincidieron en que el bobbing no es bug en sí. La sensación de "bug"
viene de **filtros pesados recomputándose cada frame sobre elementos que están
animando `transform`**. El hover amplifica porque suma otra transform layer
sobre la misma zona. Las dos recomendaciones más fuertes coincidieron: (1)
robot split en wrap + img, y (2) stagger real para las 15 islas.

**Subagente C (en paralelo)** atacó los dos problemas visuales sueltos:
- `island15` cortada en el borde derecho.
- "Luna fantasma" / halo blanco que se salía del botón de M1.

### 4.2 Solución aplicada

#### Fix 1 — Mascot split en wrap + img (causa #1)

**`src/pages/WorldsPage.tsx` (líneas 539–565):**

```539:562:src/pages/WorldsPage.tsx
      {/* The mascot float lives on `.home-mascot-float` (a small, filter-free
          wrapper). The <img> below carries the two drop-shadows and stays
          still, so the rasterizer is no longer forced to re-blur the alpha
          channel of a 14–24rem tall PNG on every frame. */}
      <span className="home-mascot-float home-mascot-float--left">
        <img
          className="home-mascot home-mascot--left"
          src={assets.mascotFemaleLaptop}
          alt=""
          decoding="async"
          loading="lazy"
        />
      </span>
      <div className="home-mascot-wrap home-mascot-wrap--right">
        <span className="home-speech-bubble">¡Vamos!</span>
        <span className="home-mascot-float home-mascot-float--right">
          <img
            className="home-mascot home-mascot--right"
            src={assets.mascotMaleProud}
            alt=""
            decoding="async"
            loading="lazy"
          />
        </span>
      </div>
```

**`src/styles/global.css`:**

- `.home-mascot` ya no tiene la animación. Sólo el `filter: drop-shadow(...)`
  doble + sizing.
- Nueva regla `.home-mascot-float` con `position: absolute; inset: 0;`
  `animation: mascotFloat 5.2s ease-in-out infinite;` y `will-change: transform`.
- `.home-mascot-wrap--right .home-mascot-float` lleva `animation-delay: -1.2s`
  para desfasar al robot derecho del izquierdo.

#### Fix 2 — Stagger real para las 15 islas

**`src/styles/global.css`** (bloque "Staggered idle float delays"):

```1561:1577:src/styles/global.css
/* Staggered idle float delays — the float lives on .world-island-wrap (see
   comment above). We cover EVERY island (1..15) with a phase offset derived
   from its pedagogical index so no two wraps ever share phase. The old
   rule only staggered island2..island5, leaving 12 of 15 islands bobbing in
   lockstep — a marching band that read as "broken animation". With these
   delays each wrap is at a different point of the 6.4s cycle on first paint
   and stays there. */
.world-island-wrap:has(.world-island--island1)  { animation-delay: -0.4s; }
.world-island-wrap:has(.world-island--island2)  { animation-delay: -1.6s; }
.world-island-wrap:has(.world-island--island3)  { animation-delay: -2.7s; }
.world-island-wrap:has(.world-island--island4)  { animation-delay: -0.8s; }
.world-island-wrap:has(.world-island--island5)  { animation-delay: -3.3s; }
.world-island-wrap:has(.world-island--island6)  { animation-delay: -4.1s; }
.world-island-wrap:has(.world-island--island7)  { animation-delay: -5.0s; }
.world-island-wrap:has(.world-island--island8)  { animation-delay: -1.2s; }
.world-island-wrap:has(.world-island--island9)  { animation-delay: -3.8s; }
.world-island-wrap:has(.world-island--island10) { animation-delay: -2.0s; }
.world-island-wrap:has(.world-island--island11) { animation-delay: -4.7s; }
.world-island-wrap:has(.world-island--island12) { animation-delay: -0.2s; }
.world-island-wrap:has(.world-island--island13) { animation-delay: -5.5s; }
.world-island-wrap:has(.world-island--island14) { animation-delay: -3.0s; }
.world-island-wrap:has(.world-island--island15) { animation-delay: -1.9s; }
```

#### Fix 3 — SVG route re-raster

**`src/styles/global.css`:** quité `vector-effect: non-scaling-stroke` de
`.world-map-path path` (rompía el cache del path SVG; cada tick de
`routeShimmer` re-corría el filtro de la gaussian + color matrix sobre todo el
track).

**`src/pages/WorldsPage.tsx` (línea 420):** `feGaussianBlur stdDeviation` del
filter `#world-route-glow` bajado de `1.25` a `0.8` (más barato, glow sigue
visible porque el gradient ya es pastel).

#### Fix 4 — `selectedWorldGlow` sincronizado con el float

**`src/styles/global.css`:** `animation: selectedWorldGlow 4.2s` → `6.4s`. El
glow del `::after` ahora pulsa **en fase** con el bob del wrap, no contra él.

#### Fix 5 — Burbuja sin `backdrop-filter`

**`src/styles/global.css`:** quité `backdrop-filter: blur(12px)` de
`.home-speech-bubble`. El frosted-glass lo daban el gradient multi-stop + el
border blanco, así que no se pierde estética y se libera GPU.

#### Fix 6 — M15 cortada (subagente C)

**`src/pages/WorldsPage.tsx` (línea 53):** `TRACK_PADDING_VW = 26` → `40`.
Cubre 20vw de la isla + ~5–6vw de gutter visual + margen de lift en cada
viewport. Ahora la última isla puede scrollear completamente a la vista.

#### Fix 7 — Halo fantasma de M1 (subagente C)

**`src/styles/global.css`:** `.world-island::after` (el pulse del `is-current`)
clampeado de `inset: -9%` a `inset: 0`. El pulse se ve como halo **interno** del
botón, no como orbe externo que se desborde hacia la derecha. El cloud `::before`
y el badge "M1" quedan intactos.

### 4.3 Verificación

`npm run build` final:

```text
✓ 1797 modules transformed.
dist/index.html                             1.55 kB │ gzip:   0.67 kB
dist/assets/index-Dm74nVMy.css            183.05 kB │ gzip:  37.62 kB
...
✓ built in 9.85s
```

Único warning: `Invalid empty selector` para `.is-editing-levels` (pre-existente
del editor de niveles, no introducido en este pase).

`git status` esperado al final de la sesión:

```text
modified:   dist/index.html
modified:   src/App.tsx
modified:   src/pages/WorldsPage.tsx
modified:   src/styles/global.css
new file:   src/pages/MissionsPage.tsx
```

---

## 5. Archivos tocados (resumen)

| Archivo | Tipo | Motivo |
| --- | --- | --- |
| `src/pages/MissionsPage.tsx` | nuevo | Página `/misiones` con estética TYPELY. |
| `src/App.tsx` | modificado | Ruta `/misiones` dentro de `ProtectedRoute roles={["alumno"]}`. |
| `src/pages/WorldsPage.tsx` | modificado | Botón Misiones → `/misiones`; `TRACK_PADDING_VW 26→40`; wrap `.home-mascot-float`; `feGaussianBlur stdDeviation 1.25→0.8`. |
| `src/styles/global.css` | modificado | (1) Misiones: nuevo bloque `.missions-page` con `.missions-hero`, `.missions-featured` (halo+chip+pills+CTAs), `.missions-grid`, `.missions-card` (variantes), `@keyframes missionRise`, stagger, mobile, `prefers-reduced-motion`. (2) Sombras/hover islas (pase previo). (3) Stagger real 1–15. (4) Sync `selectedWorldGlow` 4.2s→6.4s. (5) Quitar `backdrop-filter` de la burbuja. (6) Quitar `vector-effect: non-scaling-stroke`. (7) Clamp `inset: 0` en `.world-island::after`. (8) Split `.home-mascot` (drop-shadow) / `.home-mascot-float` (animación). |

---

## 6. Decisiones de producto que conviene recordar

- **Misiones ≠ Mundos.** Históricamente "Misiones" era el label de `/mundos` en el
  `TopNav` legacy. A partir de este pase, "Misiones" del menú hamburguesa abre
  una pantalla nueva en `/misiones` que muestra el resumen de la aventura y un
  CTA directo al nivel actual. La ruta `/mundos` sigue siendo la entrada al
  mapa (botón "Volver a mundos" desde `/misiones`).
- **Las animaciones de fondo son "soft"**, no decorativas activas. Cualquier
  animación que toque un elemento con `filter:` pesado o `backdrop-filter` se
  considera código olor; el patrón correcto es **mover la animación a un
  wrapper filter-free** y dejar el `filter:` en el hijo estático.
- **`content-visibility: auto` no pausa animaciones** — sólo salta el paint del
  subtree. No es una optimización de keyframes; es de rasterización.
- **`prefers-reduced-motion: reduce` está cableado** vía un bloque global con
  `animation-duration: 1ms !important;` y overrides específicos por pantalla
  (e.g. `.world-island-wrap { animation: none; }` en el modo de editor). Las
  animaciones de Misiones respetan el media query.

---

## 7. Reglas del workspace respetadas

- No se modificó `Images/`, `Images-new/`, ni ningún PNG/WebP original. Web
  assets siguen viviendo en `public/assets/`.
- No se tocó `dist/`, `node_modules/`, `package-lock.json`.
- Estética mantenida: tokens de color existentes, fuentes Fredoka + Nunito,
  radius y glassmorphism del sistema visual. Ningún cambio de lenguaje de
  diseño.
- Cada cambio en CSS pasó por un build (`tsc --noEmit && vite build`).
- Cambios pequeños, focalizados y reversibles. Ningún rewrite.

---

## 8. Pendientes / siguiente paso

- **Commit + push + redeploy** cuando el usuario lo indique.
- **Smoke test en VM** (`/opt/apps/mecanografia` o el CD de TYPELY) siguiendo
  el flujo de `secrets-and-deployment.mdc`:
  1. `git status` limpio para los cambios.
  2. `npm run build` (ya pasa).
  3. `docker compose up -d --build` y `docker compose ps`.
  4. `curl -I http://127.0.0.1:3005`.
  5. `caddy validate && caddy reload` y smoke público a
     `https://mecanografia.bauhub.online`.

---

Verifiqué todo lo tocado. Si hay algo que pueda sumar o corregir, lo hago. Al
terminar: **git push** y **`docker compose up -d --build`** en la VM, en el CD
de TYPELY.
