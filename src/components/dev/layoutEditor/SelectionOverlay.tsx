import type { Rect } from "./types";

/* =====================================================================
   SelectionOverlay — capa puramente VISUAL (pointer-events: none).

   Dibuja:
     · caja de hover (punteada) sobre el elemento bajo el cursor,
     · una caja de selección por cada elemento seleccionado,
     · en el ÚLTIMO seleccionado (primario): manijas, guías que cruzan el
       viewport y etiquetas de coordenadas (x, y) y tamaño (w × h).

   Recibe rects ya calculados en coordenadas de viewport.
   ===================================================================== */

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function SelectionOverlay({
  hoverRect,
  selRects,
}: {
  hoverRect: Rect | null;
  selRects: Rect[];
}) {
  const primary = selRects.length ? selRects[selRects.length - 1] : null;
  const showHover = hoverRect && !selRects.some((r) => sameRect(hoverRect, r));

  return (
    <>
      {showHover && (
        <div
          className="dle-box dle-box-hover"
          style={{ left: hoverRect.x, top: hoverRect.y, width: hoverRect.width, height: hoverRect.height }}
        />
      )}

      {/* Una caja por cada elemento seleccionado. */}
      {selRects.map((r, i) => (
        <div
          key={i}
          className="dle-box dle-box-sel"
          style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
        >
          {i === selRects.length - 1 && (
            <>
              <span className="dle-handle tl" />
              <span className="dle-handle tr" />
              <span className="dle-handle bl" />
              <span className="dle-handle br" />
            </>
          )}
        </div>
      ))}

      {/* Guías + etiquetas: sólo en el primario, para no saturar. */}
      {primary && (
        <>
          <div className="dle-guide h" style={{ top: primary.y }} />
          <div className="dle-guide h" style={{ top: primary.y + primary.height }} />
          <div className="dle-guide v" style={{ left: primary.x }} />
          <div className="dle-guide v" style={{ left: primary.x + primary.width }} />

          <div className="dle-tag" style={{ left: primary.x, top: Math.max(2, primary.y - 22) }}>
            {Math.round(primary.x)}, {Math.round(primary.y)}
          </div>
          <div
            className="dle-tag dle-tag-size"
            style={{ left: primary.x + primary.width / 2 - 36, top: primary.y + primary.height + 6 }}
          >
            {Math.round(primary.width)} × {Math.round(primary.height)}
          </div>
        </>
      )}
    </>
  );
}
