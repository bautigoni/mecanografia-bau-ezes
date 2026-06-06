import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Crosshair, Grid3x3, RotateCcw, X } from "lucide-react";
import type { LevelPosition } from "../../data/levelPositions";

/* =====================================================================
   LevelPositionEditor — DEV-ONLY level marker placement helper.

   Renders the in-map grid + crosshair, a fixed HUD panel with position
   array, and 3D perspective controls (scale, rotateX/Y/Z, perspective
   depth) for the currently selected level node.

   Keyboard shortcuts (toggle-based — press once to enter, again to exit):
     ←↑↓→            move position by 0.5 %           (Shift → 5 %)
     S                toggle SCALE mode   ↑↓ adjust
     X                toggle ROTATE X mode   ↑↓ adjust (tilt fwd/back)
     Y                toggle ROTATE Y mode   ←→ adjust (tilt left/right)
     Z                toggle ROTATE Z mode   ←→ adjust (spin)
     P                toggle PERSPECTIVE mode   ↑↓ adjust (depth)
     Escape           deselect node + exit mode
     Ctrl/Cmd + C     copy config array to clipboard + console
===================================================================== */

export interface EditorLevel {
  activityId: string;
  levelNumber: number;
}

interface LevelPositionEditorProps {
  worldSlug: string;
  positions: LevelPosition[];
  levels: EditorLevel[];
  cursor: LevelPosition | null;
  lastClick: LevelPosition | null;
  gridOn: boolean;
  selectedIndex: number;
  perspMode: "scale" | "rotateX" | "rotateY" | "rotateZ" | "persp" | null;
  numScale: number;
  onNumScaleChange: (v: number) => void;
  onSelectIndex: (index: number) => void;
  onToggleGrid: () => void;
  onReset: () => void;
  onClose: () => void;
  onCursorMove: (clientX: number, clientY: number) => void;
  onCopyAt: (clientX: number, clientY: number) => void;
  onUpdatePerspective: (index: number, field: "scale" | "rotateX" | "rotateY" | "rotateZ" | "perspective", value: number) => void;
  onToast: (text: string) => void;
}

const GRID_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const R1 = (v: number) => Math.round(v * 10) / 10;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function posString(p: LevelPosition): string {
  const parts: string[] = [];
  if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${R1(p.scale)}`);
  if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${R1(p.rotateX)}`);
  if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${R1(p.rotateY)}`);
  if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${R1(p.rotateZ)}`);
  if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${R1(p.perspective)}`);
  let line = `{ x: ${p.x}, y: ${p.y}`;
  if (parts.length > 0) line += `, ${parts.join(", ")}`;
  return line + " },";
}

function arrayLiteral(positions: LevelPosition[]): string {
  return `[\n${positions.map((p) => `  ${posString(p)}`).join("\n")}\n]`;
}

function fullJson(worldSlug: string, positions: LevelPosition[], levels: EditorLevel[]): string {
  return JSON.stringify(
    {
      worldId: worldSlug,
      islandId: worldSlug,
      levels: positions.map((p, i) => ({
        id: levels[i]?.activityId ?? `level-${i + 1}`,
        levelNumber: levels[i]?.levelNumber ?? i + 1,
        x: p.x,
        y: p.y,
        ...(p.scale !== undefined && p.scale !== 1 ? { scale: R1(p.scale) } : {}),
        ...(p.rotateX !== undefined && p.rotateX !== 0 ? { rotateX: R1(p.rotateX) } : {}),
        ...(p.rotateY !== undefined && p.rotateY !== 0 ? { rotateY: R1(p.rotateY) } : {}),
        ...(p.rotateZ !== undefined && p.rotateZ !== 0 ? { rotateZ: R1(p.rotateZ) } : {}),
        ...(p.perspective !== undefined && p.perspective !== 500 ? { perspective: R1(p.perspective) } : {}),
      })),
    },
    null,
    2,
  );
}

function TinySlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="lpe-slider">
      <span className="lpe-slider__label">{label}</span>
      <input
        type="range"
        className="lpe-slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="lpe-slider__val">{R1(value)}</span>
    </label>
  );
}

export function LevelPositionEditor({
  worldSlug,
  positions,
  levels,
  cursor,
  lastClick,
  gridOn,
  selectedIndex,
  perspMode,
  numScale,
  onNumScaleChange,
  onSelectIndex,
  onToggleGrid,
  onReset,
  onClose,
  onCursorMove,
  onCopyAt,
  onUpdatePerspective,
  onToast,
}: LevelPositionEditorProps) {
  const sel = selectedIndex >= 0 && selectedIndex < positions.length ? positions[selectedIndex] : null;

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".lpe-hud")) return;
    onCursorMove(e.clientX, e.clientY);
  }
  function handlePointerLeave() {
    onCursorMove(-99999, -99999);
  }
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".lpe-hud")) return;
    onCopyAt(e.clientX, e.clientY);
  }

  const modeLabel =
    perspMode === "scale" ? "ESCALA" :
    perspMode === "rotateX" ? "ROTATE X (inclinar fwd/back)" :
    perspMode === "rotateY" ? "ROTATE Y (inclinar izq/der)" :
    perspMode === "rotateZ" ? "ROTATE Z (girar)" :
    perspMode === "persp" ? "PERSPECTIVA (profundidad)" :
    "posicion";

  async function copyArray() {
    const ok = await copyText(`${arrayLiteral(positions)}`);
    onToast(ok ? "Arreglo copiado · pegalo en levelPositions.ts" : "No se pudo copiar.");
  }
  async function copyJson() {
    const ok = await copyText(fullJson(worldSlug, positions, levels));
    onToast(ok ? "JSON completo copiado al portapapeles." : "No se pudo copiar.");
  }

  return (
    <>
      {/* In-map layer: grid + crosshair + click/move capture. */}
      <div className="lpe-layer" aria-hidden="true">
        {gridOn && (
          <svg className="lpe-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
            {GRID_LINES.map((n) => (
              <line key={`v${n}`} x1={n} y1={0} x2={n} y2={100} className={n === 50 ? "lpe-grid__mid" : ""} />
            ))}
            {GRID_LINES.map((n) => (
              <line key={`h${n}`} x1={0} y1={n} x2={100} y2={n} className={n === 50 ? "lpe-grid__mid" : ""} />
            ))}
          </svg>
        )}

        {cursor && (
          <>
            <div className="lpe-crosshair lpe-crosshair--v" style={{ left: `${cursor.x}%` }} />
            <div className="lpe-crosshair lpe-crosshair--h" style={{ top: `${cursor.y}%` }} />
            <div className="lpe-cursor-label" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}>
              x {cursor.x} · y {cursor.y}
            </div>
          </>
        )}

        <div
          className="lpe-capture"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        />
      </div>

      {/* Fixed HUD panel. */}
      <div className="lpe-hud" role="dialog" aria-label="Editor de posiciones de niveles">
        <div className="lpe-hud__head">
          <strong><Crosshair size={15} /> Editor · {worldSlug}</strong>
          <button type="button" className="lpe-hud__close" aria-label="Cerrar editor" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="lpe-hud__hint">
          Arrastra cada numero hasta su plataforma. Clic en un nodo para editar su perspectiva 3D.
        </p>

        <div className="lpe-hud__readout">
          <span>Cursor: {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}</span>
          <span>Ultimo clic: {lastClick ? `x ${lastClick.x} · y ${lastClick.y}` : "—"}</span>
          <span>
            Nodo seleccionado:{" "}
            {sel ? `Nivel ${selectedIndex + 1}  x ${sel.x} · y ${sel.y}` : "ninguno"}
          </span>
          <span>
            Modo:{" "}
            <strong className={`lpe-mode-badge ${perspMode ? "is-on" : ""}`}>
              {modeLabel}
            </strong>
            {" "}(teclea S / X / Y / Z / P para cambiar)
          </span>
        </div>

        <div className="lpe-hud__toggles">
          <button type="button" className={`lpe-chip ${gridOn ? "is-on" : ""}`} onClick={onToggleGrid}>
            <Grid3x3 size={14} /> Grilla 10%
          </button>
          <button type="button" className="lpe-chip" onClick={onReset}>
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>

        {/* ── Global number size ── */}
        <label className="lpe-slider">
          <span className="lpe-slider__label">NumSize</span>
          <input
            type="range"
            className="lpe-slider__input"
            min={0.5}
            max={2.5}
            step={0.05}
            value={numScale}
            onChange={(e) => onNumScaleChange(Number(e.target.value))}
          />
          <span className="lpe-slider__val">{R1(numScale)}</span>
        </label>

        {/* ── 3D Perspective controls (visible only when a node is selected) ── */}
        {sel && (
          <div className="lpe-perspective">
            <strong className="lpe-perspective__title">
              Perspectiva 3D — Nivel {selectedIndex + 1}
            </strong>
            <TinySlider
              label="Scale"
              value={sel.scale ?? 1}
              min={0.1}
              max={2.5}
              step={0.01}
              onChange={(v) => onUpdatePerspective(selectedIndex, "scale", v)}
            />
            <TinySlider
              label="Rotate X"
              value={sel.rotateX ?? 0}
              min={-85}
              max={85}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateX", v)}
            />
            <TinySlider
              label="Rotate Y"
              value={sel.rotateY ?? 0}
              min={-85}
              max={85}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateY", v)}
            />
            <TinySlider
              label="Rotate Z"
              value={sel.rotateZ ?? 0}
              min={-180}
              max={180}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateZ", v)}
            />
            <TinySlider
              label="Perspective"
              value={sel.perspective ?? 500}
              min={50}
              max={2000}
              step={10}
              onChange={(v) => onUpdatePerspective(selectedIndex, "perspective", v)}
            />
          </div>
        )}

        {/* ── Keyboard shortcut cheatsheet ── */}
        <details className="lpe-kbd">
          <summary className="lpe-kbd__summary">Atajos de teclado</summary>
          <table className="lpe-kbd__table">
            <tbody>
              <tr><td><kbd><ArrowLeft size={10} /></kbd><kbd><ArrowRight size={10} /></kbd><kbd><ArrowUp size={10} /></kbd><kbd><ArrowDown size={10} /></kbd></td><td>Mover nodo (posicion)</td></tr>
              <tr><td><kbd>S</kbd></td><td><strong>Toggle modo ESCALA</strong> (↑↓)</td></tr>
              <tr><td><kbd>X</kbd></td><td><strong>Toggle modo ROTATE X</strong> (↑↓) — inclina adelante/atras como apoyado en el piso</td></tr>
              <tr><td><kbd>Y</kbd></td><td><strong>Toggle modo ROTATE Y</strong> (←→) — inclina izquierda/derecha</td></tr>
              <tr><td><kbd>Z</kbd></td><td><strong>Toggle modo ROTATE Z</strong> (←→) — gira sobre su centro</td></tr>
              <tr><td><kbd>P</kbd></td><td><strong>Toggle modo PERSPECTIVA</strong> (↑↓) — profundidad 3D</td></tr>
              <tr><td><kbd>Shift</kbd> + flechas</td><td>Multiplica el paso por 10</td></tr>
              <tr><td><kbd>Escape</kbd></td><td>Deseleccionar nodo + salir de modo</td></tr>
              <tr><td><kbd>Ctrl</kbd> + <kbd>C</kbd></td><td>Copiar config a portapapeles + consola</td></tr>
            </tbody>
          </table>
        </details>

        <pre className="lpe-hud__json">{arrayLiteral(positions)}</pre>

        <div className="lpe-hud__actions">
          <button type="button" className="lpe-btn lpe-btn--primary" onClick={copyArray}>
            <Copy size={15} /> Copiar arreglo
          </button>
          <button type="button" className="lpe-btn" onClick={copyJson}>
            <Copy size={15} /> Copiar JSON
          </button>
        </div>
      </div>
    </>
  );
}
