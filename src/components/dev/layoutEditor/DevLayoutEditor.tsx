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
     · atajo Ctrl+Shift+D (mostrar/ocultar)                → useEditorShortcuts
     · selección MÚLTIPLE (Shift+click) + hover + arrastre → useElementPicker
     · estado por elemento (ediciones + dirty + estilo original) → WeakMaps
     · preview en vivo (inline !important) + "Generar CSS"

   Selección múltiple: Shift+click suma/quita; arrastrar cualquiera mueve TODO
   el conjunto (transform translate); las flechas también. El panel muestra el
   PRIMARIO (último clickeado) para editar valores cuando hay uno solo.

   Robustez (ver layoutStyle): sólo aplica lo tocado, con !important, y un
   MutationObserver re-asienta los cambios si la app reescribe el `style`.

   Portal en <body>. `export default` porque se importa diferido sólo en dev.
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
function rectsEq(a: Rect[], b: Rect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!rectEq(a[i], b[i])) return false;
  return true;
}

function dirtyForPatch(keys: (keyof LayoutEdits)[]): DirtyKey[] {
  const out: DirtyKey[] = [];
  for (const k of keys) {
    if (
      k === "scale" ||
      k === "rotateX" ||
      k === "rotateY" ||
      k === "rotateZ" ||
      k === "translateX" ||
      k === "translateY" ||
      k === "perspective"
    )
      out.push("transform");
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
  const [selected, setSelected] = useState<HTMLElement[]>([]);
  const [primary, setPrimary] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<HTMLElement | null>(null);
  const [edits, setEdits] = useState<LayoutEdits | null>(null);
  const [dirty, setDirty] = useState<Set<DirtyKey>>(() => new Set());
  const [selRects, setSelRects] = useState<Rect[]>([]);
  const [hoverRect, setHoverRect] = useState<Rect | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const editsStore = useRef(new WeakMap<HTMLElement, LayoutEdits>());
  const dirtyStore = useRef(new WeakMap<HTMLElement, Set<DirtyKey>>());
  const originalStyle = useRef(new WeakMap<HTMLElement, string>());
  const dragState = useRef<{ items: { el: HTMLElement; origin: LayoutEdits }[] } | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Refs sincrónicas (la selección debe estar disponible al instante para el
  // arrastre, que arranca en el mismo pointerdown que la selección).
  const selectionRef = useRef<HTMLElement[]>([]);
  const primaryRef = useRef<HTMLElement | null>(null);
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

  const ensureTracked = useCallback((el: HTMLElement) => {
    if (!originalStyle.current.has(el)) originalStyle.current.set(el, el.getAttribute("style") ?? "");
    if (!editsStore.current.has(el)) editsStore.current.set(el, readEdits(el));
    if (!dirtyStore.current.has(el)) dirtyStore.current.set(el, new Set());
  }, []);

  const syncPrimary = useCallback((el: HTMLElement | null) => {
    primaryRef.current = el;
    setPrimary(el);
    if (el) {
      setEdits(editsStore.current.get(el) ?? readEdits(el));
      setDirty(new Set(dirtyStore.current.get(el) ?? []));
    } else {
      setEdits(null);
      setDirty(new Set());
    }
  }, []);

  const setSelection = useCallback((next: HTMLElement[]) => {
    selectionRef.current = next;
    setSelected(next);
  }, []);

  /* ── Selección con soporte Shift (múltiple). Devuelve si arranca arrastre. ── */
  const select = useCallback(
    (el: HTMLElement, additive: boolean): boolean => {
      ensureTracked(el);
      const cur = selectionRef.current;
      let next: HTMLElement[];
      let startDrag = true;
      if (additive) {
        if (cur.includes(el)) {
          next = cur.filter((x) => x !== el); // Shift+click sobre uno ya elegido → quitar
          startDrag = false;
        } else {
          next = [...cur, el]; // sumar a la selección
        }
      } else {
        next = cur.includes(el) ? cur : [el]; // click normal: si es del grupo, mantener; si no, reemplazar
      }
      setSelection(next);
      const prim = next.includes(el) ? el : next[next.length - 1] ?? null;
      syncPrimary(prim);
      return startDrag && next.length > 0;
    },
    [ensureTracked, setSelection, syncPrimary],
  );

  const deselect = useCallback(() => {
    setSelection([]);
    syncPrimary(null);
    setHovered(null);
  }, [setSelection, syncPrimary]);

  /* ── Subir al elemento PADRE: clave cuando clickeás un hijo (p. ej. una de
        las dos <img> normal/hover de un botón) pero querés mover el contenedor
        que las agrupa, para que se muevan SIEMPRE juntas. ── */
  const selectParent = useCallback(() => {
    const el = primaryRef.current;
    if (!el) return;
    const p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement || isEditorNode(p)) return;
    ensureTracked(p);
    setSelection([p]);
    syncPrimary(p);
  }, [ensureTracked, isEditorNode, setSelection, syncPrimary]);

  /* ── Arrastre del conjunto: cada elemento parte de su propio origen y recibe
        el mismo delta (transform translate). ── */
  const onDragStart = useCallback(() => {
    dragState.current = {
      items: selectionRef.current.map((el) => ({ el, origin: editsStore.current.get(el) ?? readEdits(el) })),
    };
  }, []);

  const onDragMove = useCallback((dx: number, dy: number) => {
    const ds = dragState.current;
    if (!ds) return;
    for (const { el, origin } of ds.items) {
      const next: LayoutEdits = {
        ...origin,
        translateX: origin.translateX + ROUND(dx),
        translateY: origin.translateY + ROUND(dy),
      };
      const nd = new Set(dirtyStore.current.get(el) ?? []);
      nd.add("transform");
      editsStore.current.set(el, next);
      dirtyStore.current.set(el, nd);
      applyEdits(el, next, nd);
      if (el === primaryRef.current) {
        setEdits(next);
        setDirty(nd);
      }
    }
  }, []);

  const onDragEnd = useCallback(() => {
    dragState.current = null;
  }, []);

  /* ── Mover TODA la selección un delta incremental (flechas del teclado). ── */
  const nudgeAll = useCallback((dx: number, dy: number) => {
    for (const el of selectionRef.current) {
      const cur = editsStore.current.get(el) ?? readEdits(el);
      const next: LayoutEdits = { ...cur, translateX: cur.translateX + dx, translateY: cur.translateY + dy };
      const nd = new Set(dirtyStore.current.get(el) ?? []);
      nd.add("transform");
      editsStore.current.set(el, next);
      dirtyStore.current.set(el, nd);
      applyEdits(el, next, nd);
      if (el === primaryRef.current) {
        setEdits(next);
        setDirty(nd);
      }
    }
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
    hasSelection: selected.length > 0,
    onToggle: () => setActive((a) => !a),
    onDeselect: deselect,
    onClose: () => setActive(false),
    onNudge: nudgeAll,
  });

  /* ── Edición desde el panel: aplica al PRIMARIO. ── */
  const patch = useCallback((partial: Partial<LayoutEdits>) => {
    const el = primaryRef.current;
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
    for (const el of selectionRef.current) {
      const original = originalStyle.current.get(el) ?? "";
      if (original) el.setAttribute("style", original);
      else el.removeAttribute("style");
      editsStore.current.set(el, readEdits(el));
      dirtyStore.current.set(el, new Set());
    }
    syncPrimary(primaryRef.current);
  }, [syncPrimary]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const cssForSelection = useCallback((): string => {
    return selectionRef.current
      .map((el) => generateCss(el, editsStore.current.get(el) ?? readEdits(el), dirtyStore.current.get(el) ?? new Set()))
      .join("\n\n");
  }, []);

  const generate = useCallback(async () => {
    if (selectionRef.current.length === 0) return;
    const css = cssForSelection();
    const ok = await copyToClipboard(css);
    showToast(ok ? "✓ CSS copiado al portapapeles" : "CSS generado (copialo del panel)");
  }, [cssForSelection, showToast]);

  /* ── Re-asentar nuestras ediciones si la app reescribe el style de algún
        elemento seleccionado (hover/re-render). ── */
  useEffect(() => {
    if (!active || selected.length === 0) return;
    const reassert = () => {
      for (const el of selectionRef.current) {
        const e = editsStore.current.get(el);
        const d = dirtyStore.current.get(el);
        if (e && d && d.size) applyEdits(el, e, d);
      }
    };
    const obs = new MutationObserver(() => {
      obs.disconnect();
      reassert();
      for (const el of selectionRef.current) obs.observe(el, { attributes: true, attributeFilter: ["style"] });
    });
    for (const el of selected) obs.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, [active, selected]);

  /* ── Bucle rAF: cajas pegadas a los elementos. ── */
  useEffect(() => {
    if (!active) {
      setHoverRect(null);
      setSelRects([]);
      return;
    }
    let raf = 0;
    let lastSel: Rect[] = [];
    let lastHov: Rect | null = null;
    const tick = () => {
      const s = selectionRef.current.map((el) => toRect(el.getBoundingClientRect()));
      const h = hoveredRef.current ? toRect(hoveredRef.current.getBoundingClientRect()) : null;
      if (!rectsEq(s, lastSel)) {
        lastSel = s;
        setSelRects(s);
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

  const selector = useMemo(() => (primary ? buildSelector(primary) : null), [primary, edits]);
  const describe = useMemo(() => (primary ? describeElement(primary) : null), [primary]);
  const css = useMemo(() => (selected.length ? cssForSelection() : ""), [selected, edits, dirty, cssForSelection]);

  if (!active) return null;

  return createPortal(
    <div ref={rootRef} className="dle-root">
      <style>{EDITOR_CSS}</style>

      {selected.length === 0 && (
        <div className="dle-mode-pill">
          <span className="dle-dot" /> Editor activo — click para elegir · Shift+click para varios
        </div>
      )}

      <SelectionOverlay hoverRect={hoverRect} selRects={selRects} />

      <PropertiesPanel
        count={selected.length}
        selector={selector}
        describe={describe}
        edits={edits}
        css={css}
        onPatch={patch}
        onGenerate={generate}
        onReset={reset}
        onDeselect={deselect}
        onSelectParent={selectParent}
        onClose={() => setActive(false)}
      />

      {toast && <div className="dle-toast">{toast}</div>}
    </div>,
    document.body,
  );
}
