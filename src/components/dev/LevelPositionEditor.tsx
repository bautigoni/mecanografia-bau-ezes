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
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="flex-1 h-1.5 accent-accent-strong cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="text-xs font-mono font-bold text-text min-w-[3rem] text-right tabular-nums">
          {R1(value)}
        </span>
      </div>
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
    if ((e.target as HTMLElement).closest("[data-hud]")) return;
    onCursorMove(e.clientX, e.clientY);
  }
  function handlePointerLeave() {
    onCursorMove(-99999, -99999);
  }
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-hud]")) return;
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
      {/* ── In-map layer: grid + crosshair + click/move capture. ── */}
      <div className="absolute inset-0 z-[7] pointer-events-none" aria-hidden="true">
        {gridOn && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {GRID_LINES.map((n) => (
              <line
                key={`v${n}`}
                x1={n} y1={0} x2={n} y2={100}
                stroke={n === 50 ? "rgba(49,89,232,0.55)" : "rgba(49,89,232,0.18)"}
                strokeWidth={n === 50 ? "0.35" : "0.15"}
              />
            ))}
            {GRID_LINES.map((n) => (
              <line
                key={`h${n}`}
                x1={0} y1={n} x2={100} y2={n}
                stroke={n === 50 ? "rgba(49,89,232,0.55)" : "rgba(49,89,232,0.18)"}
                strokeWidth={n === 50 ? "0.35" : "0.15"}
              />
            ))}
          </svg>
        )}

        {cursor && (
          <>
            {/* Vertical crosshair */}
            <div
              className="absolute top-0 bottom-0 w-px bg-accent-strong/60"
              style={{ left: `${cursor.x}%` }}
            />
            {/* Horizontal crosshair */}
            <div
              className="absolute left-0 right-0 h-px bg-accent-strong/60"
              style={{ top: `${cursor.y}%` }}
            />
            {/* Cursor coordinate label */}
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded bg-accent-strong/90 text-white text-[10px] font-mono font-bold whitespace-nowrap pointer-events-none"
              style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
            >
              x {cursor.x} · y {cursor.y}
            </div>
          </>
        )}

        <div
          className="pointer-events-auto cursor-crosshair absolute inset-0"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        />
      </div>

      {/* ── Fixed HUD panel. ── */}
      <div
        data-hud
        className="fixed right-4 top-4 z-20 glass-surface p-4 rounded-xl w-72 flex flex-col gap-3 max-h-[calc(100dvh-2rem)] overflow-y-auto animate-hud-in"
        role="dialog"
        aria-label="Editor de posiciones de niveles"
      >
        {/* Head */}
        <div className="flex items-center justify-between gap-2">
          <strong className="flex items-center gap-1.5 text-text text-sm font-extrabold">
            <Crosshair size={15} /> Editor · {worldSlug}
          </strong>
          <button
            type="button"
            className="grid place-items-center w-7 h-7 rounded-lg text-muted hover:bg-rose/10 hover:text-rose transition cursor-pointer"
            aria-label="Cerrar editor"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Arrastra cada numero hasta su plataforma. Clic en un nodo para editar su perspectiva 3D.
        </p>

        {/* Readout */}
        <div className="flex flex-col gap-1.5 text-xs text-muted font-mono">
          <span>Cursor: {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}</span>
          <span>Ultimo clic: {lastClick ? `x ${lastClick.x} · y ${lastClick.y}` : "—"}</span>
          <span>
            Nodo seleccionado:{" "}
            {sel ? `Nivel ${selectedIndex + 1}  x ${sel.x} · y ${sel.y}` : "ninguno"}
          </span>
          <span className="flex items-center gap-1.5 flex-wrap">
            Modo:{" "}
            <strong
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                perspMode
                  ? "bg-accent-strong text-white"
                  : "bg-white/60 text-muted"
              }`}
            >
              {modeLabel}
            </strong>
            {" "}(teclea S / X / Y / Z / P para cambiar)
          </span>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              gridOn
                ? "bg-accent-strong text-white shadow-sm"
                : "glass-surface text-muted hover:text-text"
            }`}
            onClick={onToggleGrid}
          >
            <Grid3x3 size={14} /> Grilla 10%
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold glass-surface text-muted hover:text-text transition cursor-pointer"
            onClick={onReset}
          >
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>

        {/* ── Global number size ── */}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wide">NumSize</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              className="flex-1 h-1.5 accent-accent-strong cursor-pointer"
              min={0.5}
              max={2.5}
              step={0.05}
              value={numScale}
              onChange={(e) => onNumScaleChange(Number(e.target.value))}
            />
            <span className="text-xs font-mono font-bold text-text min-w-[3rem] text-right tabular-nums">
              {R1(numScale)}
            </span>
          </div>
        </label>

        {/* ── 3D Perspective controls (visible only when a node is selected) ── */}
        {sel && (
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white/40 border border-white/50">
            <strong className="text-xs font-extrabold text-text uppercase tracking-wide">
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
        <details className="flex flex-col gap-1">
          <summary className="text-xs font-bold text-muted cursor-pointer hover:text-text transition select-none">
            Atajos de teclado
          </summary>
          <table className="text-[11px] text-muted mt-1 border-separate border-spacing-y-0.5">
            <tbody>
              <tr>
                <td className="pr-2">
                  <span className="inline-flex gap-0.5">
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowLeft size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowRight size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowUp size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowDown size={10} /></kbd>
                  </span>
                </td>
                <td>Mover nodo (posicion)</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">S</kbd></td>
                <td><strong className="text-text">Toggle modo ESCALA</strong> (↑↓)</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">X</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE X</strong> (↑↓) — inclina adelante/atras como apoyado en el piso</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Y</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE Y</strong> (←→) — inclina izquierda/derecha</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Z</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE Z</strong> (←→) — gira sobre su centro</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">P</kbd></td>
                <td><strong className="text-text">Toggle modo PERSPECTIVA</strong> (↑↓) — profundidad 3D</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Shift</kbd> + flechas</td>
                <td>Multiplica el paso por 10</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Escape</kbd></td>
                <td>Deseleccionar nodo + salir de modo</td>
              </tr>
              <tr>
                <td className="pr-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">C</kbd>
                </td>
                <td>Copiar config a portapapeles + consola</td>
              </tr>
            </tbody>
          </table>
        </details>

        {/* JSON preview */}
        <pre className="text-[10px] font-mono text-muted bg-white/40 border border-white/50 rounded-lg p-2 overflow-x-auto whitespace-pre leading-relaxed max-h-40">
          {arrayLiteral(positions)}
        </pre>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-accent-strong text-white shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition cursor-pointer"
            onClick={copyArray}
          >
            <Copy size={15} /> Copiar arreglo
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold glass-surface text-text hover:bg-white/80 transition cursor-pointer"
            onClick={copyJson}
          >
            <Copy size={15} /> Copiar JSON
          </button>
        </div>
      </div>
    </>
  );
}
