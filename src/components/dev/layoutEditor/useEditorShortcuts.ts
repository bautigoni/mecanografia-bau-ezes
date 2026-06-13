import { useEffect } from "react";

/* =====================================================================
   useEditorShortcuts — atajos globales del editor.

     Ctrl + Shift + D   → mostrar / ocultar el editor (requisito 7)
     Escape             → si hay algo seleccionado, deselecciona;
                          si no, oculta el editor.

   Este es el ÚNICO listener que vive mientras el editor está oculto (en
   desarrollo). En producción el módulo entero no se carga, así que no hay
   ningún listener (requisito 1).
   ===================================================================== */

export function useEditorShortcuts(opts: {
  active: boolean;
  hasSelection: boolean;
  onToggle: () => void;
  onDeselect: () => void;
  onClose: () => void;
}): void {
  const { active, hasSelection, onToggle, onDeselect, onClose } = opts;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+D (case-insensitive; en algunos layouts e.key es "D").
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
        return;
      }
      if (e.key === "Escape" && active) {
        e.preventDefault();
        if (hasSelection) onDeselect();
        else onClose();
      }
    }
    // Captura para ganarle a los handlers de la app.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, hasSelection, onToggle, onDeselect, onClose]);
}
