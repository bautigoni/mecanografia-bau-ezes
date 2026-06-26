import { useEffect, useRef } from "react";

/* =====================================================================
   useElementPicker — selección + arrastre estilo "inspector".

   Mientras el editor está ACTIVO, en fase de captura sobre `document`:
     · pointermove → resalta el elemento bajo el cursor (hover).
     · pointerdown → selecciona (o suma/quita con Shift) y, si corresponde,
       empieza un arrastre del CONJUNTO seleccionado.
     · pointermove (con botón) → arrastra (delta dx/dy suave).
     · pointerup → termina el arrastre.
     · click       → se neutraliza sobre elementos de la app, para que los
                     botones/enlaces no se disparen al seleccionar.

   `onSelect(el, additive)` devuelve si debe arrancar el arrastre (false p. ej.
   cuando Shift+click DESELECCIONA un elemento). Los nodos del propio editor se
   ignoran vía `isEditorNode` para no auto-seleccionar el panel.
   ===================================================================== */

interface PickerCallbacks {
  onHover: (el: HTMLElement | null) => void;
  /** Devuelve true si tras la selección debe iniciarse un arrastre. */
  onSelect: (el: HTMLElement, additive: boolean) => boolean;
  onDragStart: () => void;
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

export function useElementPicker(
  active: boolean,
  isEditorNode: (target: EventTarget | null) => boolean,
  callbacks: PickerCallbacks,
): void {
  const cb = useRef(callbacks);
  cb.current = callbacks;

  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;

    function onPointerMove(e: PointerEvent) {
      if (dragging.current) {
        cb.current.onDragMove(e.clientX - start.current.x, e.clientY - start.current.y);
        e.preventDefault();
        return;
      }
      const t = e.target;
      if (isEditorNode(t) || !(t instanceof HTMLElement)) {
        cb.current.onHover(null);
        return;
      }
      cb.current.onHover(t);
    }

    function onPointerDown(e: PointerEvent) {
      if (isEditorNode(e.target)) return; // dejar pasar el panel
      if (!(e.target instanceof HTMLElement)) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      start.current = { x: e.clientX, y: e.clientY };
      // Alt+click selecciona el PADRE del elemento clickeado (subir un nivel
      // para agarrar el contenedor en vez del hijo más profundo).
      let target: HTMLElement = e.target;
      if (e.altKey && target.parentElement instanceof HTMLElement && !isEditorNode(target.parentElement)) {
        target = target.parentElement;
      }
      const startDrag = cb.current.onSelect(target, e.shiftKey);
      if (startDrag) {
        dragging.current = true;
        cb.current.onDragStart();
      }
    }

    function onPointerUp() {
      if (!dragging.current) return;
      dragging.current = false;
      cb.current.onDragEnd();
    }

    function onClick(e: MouseEvent) {
      if (isEditorNode(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
      dragging.current = false;
    };
  }, [active, isEditorNode]);
}
