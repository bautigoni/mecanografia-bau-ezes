import { useEffect } from "react";

/* =====================================================================
   useEditorShortcuts — atajos globales del editor.

     Ctrl + Shift + D   → mostrar / ocultar el editor (requisito 7)
     Escape             → deselecciona si hay selección; si no, oculta
     Flechas            → mueve TODA la selección 1px (Shift → 10px)

   Las flechas se ignoran si el foco está en un input/select del panel (para
   no pisar el ajuste numérico). Este es el único listener que vive con el
   editor oculto en desarrollo; en producción el módulo no se carga.
   ===================================================================== */

export function useEditorShortcuts(opts: {
  active: boolean;
  hasSelection: boolean;
  onToggle: () => void;
  onDeselect: () => void;
  onClose: () => void;
  onNudge: (dx: number, dy: number) => void;
}): void {
  const { active, hasSelection, onToggle, onDeselect, onClose, onNudge } = opts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
        return;
      }
      if (!active) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (hasSelection) onDeselect();
        else onClose();
        return;
      }

      // Mover la selección con las flechas (salvo si se está tipeando un valor).
      if (hasSelection && e.key.startsWith("Arrow")) {
        const tag = (document.activeElement?.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        const step = e.shiftKey ? 10 : 1;
        const map: Record<string, [number, number]> = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
        };
        const delta = map[e.key];
        if (delta) {
          e.preventDefault();
          onNudge(delta[0], delta[1]);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, hasSelection, onToggle, onDeselect, onClose, onNudge]);
}
