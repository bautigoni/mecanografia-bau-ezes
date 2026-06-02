import { Copy, Crosshair, Grid3x3, RotateCcw, X } from "lucide-react";
import type { LevelPosition } from "../../data/levelPositions";

/* =====================================================================
   LevelPositionEditor — DEV-ONLY level marker placement helper.

   This overlay is rendered ONLY in dev builds (guarded by
   import.meta.env.DEV in IslandDetailPage) and ONLY when the editor is
   toggled on. It never ships to students/production.

   It draws:
     - an optional 10% grid + axis labels over the level map,
     - a crosshair with a live x/y % readout that follows the cursor,
     - a fixed HUD panel with the current positions as JSON and buttons
       to copy them (array form for levelPositions.ts, or full JSON).

   It is purely presentational: dragging the markers and click-to-copy
   are handled by IslandDetailPage (which owns the markers and the map
   ref). This component just forwards pointer coordinates back up via
   onCursorMove / onCopyAt.
===================================================================== */

export interface EditorLevel {
  activityId: string;
  levelNumber: number;
}

interface LevelPositionEditorProps {
  worldSlug: string;
  positions: LevelPosition[];
  levels: EditorLevel[];
  /** Live cursor position in map %, or null when the pointer is away. */
  cursor: LevelPosition | null;
  /** Last clicked coordinate (copied to clipboard), shown in the HUD. */
  lastClick: LevelPosition | null;
  gridOn: boolean;
  onToggleGrid: () => void;
  onReset: () => void;
  onClose: () => void;
  /** Forward raw client coords; the page converts them to map %. */
  onCursorMove: (clientX: number, clientY: number) => void;
  onCopyAt: (clientX: number, clientY: number) => void;
  onToast: (text: string) => void;
}

const GRID_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];

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

function arrayLiteral(positions: LevelPosition[]): string {
  const rows = positions.map((p) => `  { x: ${p.x}, y: ${p.y} },`).join("\n");
  return `[\n${rows}\n]`;
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
      })),
    },
    null,
    2,
  );
}

export function LevelPositionEditor({
  worldSlug,
  positions,
  levels,
  cursor,
  lastClick,
  gridOn,
  onToggleGrid,
  onReset,
  onClose,
  onCursorMove,
  onCopyAt,
  onToast,
}: LevelPositionEditorProps) {
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
      {/* In-map layer: grid + crosshair + click/move capture. Sits below the
          markers (z-index) so dragging a marker still works; clicks on empty
          map area copy that coordinate. */}
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

        {/* Capture surface — pointer events land here only where there is no
            marker on top, so empty-area clicks copy coordinates. */}
        <div
          className="lpe-capture"
          onPointerMove={(e) => onCursorMove(e.clientX, e.clientY)}
          onPointerLeave={() => onCursorMove(-99999, -99999)}
          onClick={(e) => onCopyAt(e.clientX, e.clientY)}
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
          Arrastrá cada número hasta su plataforma. Hacé clic en el mapa para copiar una coordenada.
        </p>

        <div className="lpe-hud__readout">
          <span>Cursor: {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}</span>
          <span>Último clic: {lastClick ? `x ${lastClick.x} · y ${lastClick.y}` : "—"}</span>
        </div>

        <div className="lpe-hud__toggles">
          <button type="button" className={`lpe-chip ${gridOn ? "is-on" : ""}`} onClick={onToggleGrid}>
            <Grid3x3 size={14} /> Grilla 10%
          </button>
          <button type="button" className="lpe-chip" onClick={onReset}>
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>

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
