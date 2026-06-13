import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PropertiesPanel } from "./PropertiesPanel";
import { SelectionOverlay } from "./SelectionOverlay";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useElementPicker } from "./useElementPicker";
import { buildSelector, describeElement } from "./cssSelector";
import { applyEdits, copyToClipboard, generateCss, readEdits } from "./layoutStyle";
import { EDITOR_CSS } from "./styles";
import type { DirtyKey, LayoutEdits, Rect } from "./types";

/* =====================================================================
   DevLayoutEditor — controlador del editor de layout (SOLO desarrollo).

   Orquesta:
     · atajo Ctrl+Shift+D (mostrar/ocultar)        → useEditorShortcuts
     · selección + hover + arrastre tipo inspector → useElementPicker
     · estado por elemento: ediciones + qué props se tocaron (dirty) + estilo
       original → WeakMaps
     · preview en vivo (estilos inline !important) + "Generar CSS"

   Claves de robustez (corrige el bug de "el objeto vuelve a su posición"):
     1) Sólo se aplican/exportan las propiedades que el usuario tocó (dirty),
        nunca un snapshot completo → no rompemos el esquema de layout original
        (p. ej. `left/top` en % o el centrado por la propiedad CSS `translate`).
     2) Se aplican con `!important`.
     3) Un MutationObserver RE-ASIENTA esas props si la app reescribe el
        `style` del elemento en un re-render (hover, estado, etc.).

   Se renderiza vía portal en <body> (z-index máximo). `export default` porque
   se importa de forma diferida sólo en desarrollo (ver DevLayoutEditorMount).
   ===================================================================== */

const ROUND = (n: number) => Math.round(n);
function toRect(r: DOMRect): Rect {
  return { x: ROUND(r.left), y: ROUND(r.top), width: ROUND(r.width), height: ROUND(r.height) };
}
function rectEq(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Mapea las claves de LayoutEdits tocadas → claves dirty aplicables.
 *  (scale/rotate/translate → "transform"; un offset arrastra también
 *  "position" para que el preview y el CSS exportado sean coherentes.) */
function dirtyForPatch(keys: (keyof LayoutEdits)[]): DirtyKey[] {
  const out: DirtyKey[] = [];
  for (const k of keys) {
    if (k === "scale" || k === "rotate" || k === "translateX" || k === "translateY") out.push("transform");
    else if (k === "position") out.push("position");
    else {
      out.push(k);
      if (k === "top" || k === "left" || k === "right" || k === "bottom") out.push("position");
    }
  }
  return out;
}

export default function DevLayoutEditor() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [edits, setEdits] = useState<LayoutEdits | null>(null);
  const [dirty, setDirty] = useState<Set<DirtyKey>>(() => new Set());
  const [selRect, setSelRect] = useState<Rect | null>(null);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  // Estado por elemento (sobrevive a re-selecciones): ediciones, dirty y el
  // estilo inline original (para "Reset").
  const editsStore = useRef(new WeakMap<HTMLElement, LayoutEdits>());
  const dirtyStore = useRef(new WeakMap<HTMLElement, Set<DirtyKey>>());
  const originalStyle = useRef(new WeakMap<HTMLElement, string>());
  const dragState = useRef<{ el: HTMLElement; origin: LayoutEdits } | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Refs espejo del estado para efectos/loops sin re-suscribir.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const hoveredRef = useRef(hovered);
  hoveredRef.current = hovered;
  const editsRef = useRef(edits);
  editsRef.current = edits;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const isEditorNode = useCallback(
    (t: EventTarget | null) => !!rootRef.current && t instanceof Node && rootRef.current.contains(t),
    [],
  );

  /* ── Selección (no modifica el elemento: sólo lee para mostrar) ── */
  const select = useCallback((el: HTMLElement) => {
    if (!originalStyle.current.has(el)) originalStyle.current.set(el, el.getAttribute("style") ?? "");
    const nextEdits = editsStore.current.get(el) ?? readEdits(el);
    const nextDirty = dirtyStore.current.get(el) ?? new Set<DirtyKey>();
    editsStore.current.set(el, nextEdits);
    dirtyStore.current.set(el, nextDirty);
    setSelected(el);
    setEdits(nextEdits);
    setDirty(new Set(nextDirty));
  }, []);

  const deselect = useCallback(() => {
    setSelected(null);
    setEdits(null);
    setHovered(null);
    setDirty(new Set());
  }, []);

  /* ── Arrastre: mueve con transform translate (suave; preserva el layout
        original del elemento). Sólo marca "transform" como dirty. ── */
  const onDragStart = useCallback((el: HTMLElement) => {
    dragState.current = { el, origin: editsStore.current.get(el) ?? readEdits(el) };
  }, []);

  const onDragMove = useCallback((dx: number, dy: number) => {
    const ds = dragState.current;
    if (!ds) return;
    const next: LayoutEdits = {
      ...ds.origin,
      translateX: ds.origin.translateX + ROUND(dx),
      translateY: ds.origin.translateY + ROUND(dy),
    };
    const nd = new Set(dirtyStore.current.get(ds.el) ?? []);
    nd.add("transform");
    editsStore.current.set(ds.el, next);
    dirtyStore.current.set(ds.el, nd);
    applyEdits(ds.el, next, nd);
    setEdits(next);
    setDirty(nd);
  }, []);

  const onDragEnd = useCallback(() => {
    dragState.current = null;
  }, []);

  useElementPicker(active, isEditorNode, {
    onHover: setHovered,
    onSelect: select,
    onDragStart,
    onDragMove,
    onDragEnd,
  });

  useEditorShortcuts({
    active,
    hasSelection: selected !== null,
    onToggle: () => setActive((a) => !a),
    onDeselect: deselect,
    onClose: () => setActive(false),
  });

  /* ── Edición desde el panel: aplica sólo lo tocado, al instante ── */
  const patch = useCallback((partial: Partial<LayoutEdits>) => {
    const el = selectedRef.current;
    const prev = editsRef.current;
    if (!el || !prev) return;
    const next = { ...prev, ...partial };
    const nd = new Set(dirtyRef.current);
    for (const k of dirtyForPatch(Object.keys(partial) as (keyof LayoutEdits)[])) nd.add(k);
    editsStore.current.set(el, next);
    dirtyStore.current.set(el, nd);
    applyEdits(el, next, nd);
    setEdits(next);
    setDirty(nd);
  }, []);

  const reset = useCallback(() => {
    const el = selectedRef.current;
    if (!el) return;
    const original = originalStyle.current.get(el) ?? "";
    if (original) el.setAttribute("style", original);
    else el.removeAttribute("style");
    editsStore.current.delete(el);
    dirtyStore.current.delete(el);
    const fresh = readEdits(el);
    editsStore.current.set(el, fresh);
    const empty = new Set<DirtyKey>();
    dirtyStore.current.set(el, empty);
    setEdits(fresh);
    setDirty(empty);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const generate = useCallback(async () => {
    const el = selectedRef.current;
    const e = editsRef.current;
    if (!el || !e) return;
    const css = generateCss(el, e, dirtyRef.current);
    const ok = await copyToClipboard(css);
    showToast(ok ? "✓ CSS copiado al portapapeles" : "CSS generado (copialo del panel)");
  }, [showToast]);

  /* ── Re-asentar nuestras ediciones si la app reescribe el style del
        elemento seleccionado (hover/re-render). Sin esto, en componentes que
        controlan su `style` por React, el cambio "se devolvía" solo. ── */
  useEffect(() => {
    if (!active || !selected) return;
    const el = selected;
    const obs = new MutationObserver(() => {
      const e = editsRef.current;
      const d = dirtyRef.current;
      if (!e || d.size === 0) return;
      obs.disconnect();
      applyEdits(el, e, d);
      obs.observe(el, { attributes: true, attributeFilter: ["style"] });
    });
    obs.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, [active, selected]);

  /* ── Bucle rAF: mantiene las cajas pegadas a los elementos. ── */
  useEffect(() => {
    if (!active) {
      setHoverRect(null);
      setSelRect(null);
      return;
    }
    let raf = 0;
    let lastSel: Rect | null = null;
    let lastHov: Rect | null = null;
    const tick = () => {
      const s = selectedRef.current ? toRect(selectedRef.current.getBoundingClientRect()) : null;
      const h = hoveredRef.current ? toRect(hoveredRef.current.getBoundingClientRect()) : null;
      if (!rectEq(s, lastSel)) {
        lastSel = s;
        setSelRect(s);
      }
      if (!rectEq(h, lastHov)) {
        lastHov = h;
        setHoverRect(h);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const selector = useMemo(() => (selected ? buildSelector(selected) : null), [selected, edits]);
  const describe = useMemo(() => (selected ? describeElement(selected) : null), [selected]);
  const css = useMemo(
    () => (selected && edits ? generateCss(selected, edits, dirty) : ""),
    [selected, edits, dirty],
  );

  if (!active) return null;

  return createPortal(
    <div ref={rootRef} className="dle-root">
      <style>{EDITOR_CSS}</style>

      {!selected && (
        <div className="dle-mode-pill">
          <span className="dle-dot" /> Editor activo — hacé click en un elemento
        </div>
      )}

      <SelectionOverlay hoverRect={hoverRect} selRect={selRect} />

      <PropertiesPanel
        selector={selector}
        describe={describe}
        edits={edits}
        css={css}
        onPatch={patch}
        onGenerate={generate}
        onReset={reset}
        onDeselect={deselect}
        onClose={() => setActive(false)}
      />

      {toast && <div className="dle-toast">{toast}</div>}
    </div>,
    document.body,
  );
}
