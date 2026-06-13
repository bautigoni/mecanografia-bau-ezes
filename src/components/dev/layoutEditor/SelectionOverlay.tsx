import type { Rect } from "./types";

/* =====================================================================
   SelectionOverlay — capa puramente VISUAL (pointer-events: none).

   Dibuja:
     · caja de hover (punteada) sobre el elemento bajo el cursor,
     · caja de selección (sólida + manijas) sobre el elemento elegido,
     · etiquetas de coordenadas (x, y) y de tamaño (w × h),
     · guías que cruzan el viewport por los bordes del elemento.

   Recibe rects ya calculados en coordenadas de viewport.
   ===================================================================== */

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function SelectionOverlay({
  hoverRect,
  selRect,
}: {
  hoverRect: Rect | null;
  selRect: Rect | null;
}) {
  const showHover = hoverRect && !sameRect(hoverRect, selRect);

  return (
    <>
      {showHover && (
        <div
          className="dle-box dle-box-hover"
          style={{ left: hoverRect.x, top: hoverRect.y, width: hoverRect.width, height: hoverRect.height }}
        />
      )}

      {selRect && (
        <>
          {/* Guías que cruzan el viewport por los 4 bordes del elemento. */}
          <div className="dle-guide h" style={{ top: selRect.y }} />
          <div className="dle-guide h" style={{ top: selRect.y + selRect.height }} />
          <div className="dle-guide v" style={{ left: selRect.x }} />
          <div className="dle-guide v" style={{ left: selRect.x + selRect.width }} />

          {/* Caja de selección + manijas en las esquinas. */}
          <div
            className="dle-box dle-box-sel"
            style={{ left: selRect.x, top: selRect.y, width: selRect.width, height: selRect.height }}
          >
            <span className="dle-handle tl" />
            <span className="dle-handle tr" />
            <span className="dle-handle bl" />
            <span className="dle-handle br" />
          </div>

          {/* Coordenadas (arriba-izquierda) y tamaño (abajo-centro). */}
          <div className="dle-tag" style={{ left: selRect.x, top: Math.max(2, selRect.y - 22) }}>
            {Math.round(selRect.x)}, {Math.round(selRect.y)}
          </div>
          <div
            className="dle-tag dle-tag-size"
            style={{ left: selRect.x + selRect.width / 2 - 36, top: selRect.y + selRect.height + 6 }}
          >
            {Math.round(selRect.width)} × {Math.round(selRect.height)}
          </div>
        </>
      )}
    </>
  );
}
