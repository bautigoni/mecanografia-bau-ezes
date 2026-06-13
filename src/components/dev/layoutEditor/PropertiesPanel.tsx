import { useEffect, useRef, useState } from "react";
import type { LayoutEdits, PositionMode } from "./types";

/* =====================================================================
   PropertiesPanel — panel flotante tipo DevTools (requisito 3).

   Muestra y permite editar en tiempo real los valores del elemento
   seleccionado, ofrece "Generar CSS", "Reset" y "Deseleccionar", y muestra
   un preview del CSS. Es arrastrable desde su cabecera.

   Es presentacional: recibe `edits` y reporta cambios con `onPatch`. La
   aplicación al DOM y la generación de CSS las hace el controlador.
   ===================================================================== */

const POSITIONS: PositionMode[] = ["static", "relative", "absolute", "fixed", "sticky"];

interface Props {
  selector: string | null;
  describe: string | null;
  edits: LayoutEdits | null;
  css: string;
  onPatch: (patch: Partial<LayoutEdits>) => void;
  onGenerate: () => void;
  onReset: () => void;
  onDeselect: () => void;
  onClose: () => void;
}

/** Campo numérico (px). `nullable` permite vaciarlo → `null` (= auto). */
function NumField({
  label,
  value,
  step = 1,
  nullable = false,
  onChange,
}: {
  label: string;
  value: number | null;
  step?: number;
  nullable?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="dle-field">
      <span>{label}</span>
      <input
        className="dle-input"
        type="number"
        step={step}
        placeholder={nullable ? "auto" : "0"}
        value={value === null ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(nullable ? null : 0);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

export function PropertiesPanel(props: Props) {
  const { selector, describe, edits, css, onPatch, onGenerate, onReset, onDeselect, onClose } = props;

  // Posición del panel (arrastrable). Por defecto, arriba a la derecha.
  const [pos, setPos] = useState(() => ({
    x: Math.max(8, window.innerWidth - 280 - 16),
    y: 16,
  }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!drag.current) return;
      setPos({
        x: Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 60),
        y: Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 40),
      });
    }
    function up() {
      drag.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div className="dle-panel" style={{ left: pos.x, top: pos.y }}>
      <div
        className="dle-header"
        onPointerDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
      >
        <span className="dle-title">
          <span className="dle-dot" /> Layout Editor
        </span>
        <span className="dle-spacer" />
        <button className="dle-x" title="Cerrar (Ctrl+Shift+D)" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="dle-body">
        {!edits || !selector ? (
          <div className="dle-empty">
            Hacé click en cualquier elemento para seleccionarlo.
            <br />
            Arrastralo para moverlo.
            <br />
            <br />
            <span className="dle-kbd">Ctrl</span> + <span className="dle-kbd">Shift</span> +{" "}
            <span className="dle-kbd">D</span> para ocultar.
          </div>
        ) : (
          <>
            <div className="dle-selector" title={selector}>
              {describe}
              <div style={{ color: "#6f7c95", marginTop: 2 }}>{selector}</div>
            </div>

            <div className="dle-row">
              <label htmlFor="dle-pos">position</label>
              <select
                id="dle-pos"
                className="dle-select"
                value={edits.position}
                onChange={(e) => onPatch({ position: e.target.value as PositionMode })}
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="dle-grid">
              <NumField label="top" value={edits.top} nullable onChange={(v) => onPatch({ top: v })} />
              <NumField label="left" value={edits.left} nullable onChange={(v) => onPatch({ left: v })} />
              <NumField label="right" value={edits.right} nullable onChange={(v) => onPatch({ right: v })} />
              <NumField label="bottom" value={edits.bottom} nullable onChange={(v) => onPatch({ bottom: v })} />
              <NumField label="width" value={edits.width} nullable onChange={(v) => onPatch({ width: v })} />
              <NumField label="height" value={edits.height} nullable onChange={(v) => onPatch({ height: v })} />
              <NumField
                label="translate X"
                value={edits.translateX}
                onChange={(v) => onPatch({ translateX: v ?? 0 })}
              />
              <NumField
                label="translate Y"
                value={edits.translateY}
                onChange={(v) => onPatch({ translateY: v ?? 0 })}
              />
              <NumField label="scale" value={edits.scale} step={0.05} onChange={(v) => onPatch({ scale: v ?? 1 })} />
              <NumField label="rotate°" value={edits.rotate} onChange={(v) => onPatch({ rotate: v ?? 0 })} />
            </div>

            <div className="dle-actions">
              <button className="dle-btn dle-btn-primary" onClick={onGenerate}>
                Generar CSS
              </button>
              <button className="dle-btn" onClick={onReset} title="Volver al estilo original">
                Reset
              </button>
            </div>

            <pre className="dle-pre">{css}</pre>

            <div className="dle-actions">
              <button className="dle-btn" onClick={onDeselect}>
                Deseleccionar
              </button>
            </div>
            <div className="dle-hint">El CSS se copia al portapapeles al generar.</div>
          </>
        )}
      </div>
    </div>
  );
}
