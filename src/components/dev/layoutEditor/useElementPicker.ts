import { useEffect, useRef } from "react";

/* =====================================================================
   useElementPicker — selección + arrastre estilo "inspector".

   Mientras el editor está ACTIVO, en fase de captura sobre `document`:
     · pointermove → resalta el elemento bajo el cursor (hover).
     · pointerdown → selecciona ese elemento y empieza un posible arrastre.
     · pointermove (con botón) → arrastra (delta dx/dy suave).
     · pointerup → termina el arrastre.
     · click       → se neutraliza sobre elementos de la app, para que los
                     botones/enlaces no se disparen al seleccionar.

   Los nodos del propio editor (panel) se ignoran vía `isEditorNode`, así el
   panel sigue siendo interactivo con normalidad.

   Los callbacks se guardan en refs para no re-suscribir listeners en cada
   render (drag suave, sin parpadeos).
   ===================================================================== */

interface PickerCallbacks {
  onHover: (el: HTMLElement | null) => void;
  onSelect: (el: HTMLElement) => void;
  onDragStart: (el: HTMLElement) => void;
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
  const target = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    function onPointerMove(e: PointerEvent) {
      if (dragging.current) {
        // Arrastre en curso → delta desde el inicio del gesto.
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
      // Sobre el panel del editor: dejar pasar (inputs, botones, drag del panel).
      if (isEditorNode(e.target)) return;
      if (!(e.target instanceof HTMLElement)) return;
      if (e.button !== 0) return; // sólo botón principal
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      target.current = el;
      start.current = { x: e.clientX, y: e.clientY };
      dragging.current = true;
      cb.current.onSelect(el);
      cb.current.onDragStart(el);
    }

    function onPointerUp() {
      if (!dragging.current) return;
      dragging.current = false;
      target.current = null;
      cb.current.onDragEnd();
    }

    // Mientras el editor está activo, los clicks sobre la app se neutralizan
    // (si no, seleccionar un botón lo "presionaría").
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
