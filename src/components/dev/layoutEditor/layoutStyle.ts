/* =====================================================================
   layoutStyle — leer / aplicar / serializar las ediciones de layout.

   Modelo: la herramienta aplica todo como ESTILOS INLINE sobre el elemento
   (preview instantáneo) y luego serializa esas ediciones a una regla CSS
   con un selector limpio. Mantiene una instantánea del `cssText` original
   por elemento para poder "Resetear".
   ===================================================================== */

import { buildSelector } from "./cssSelector";
import type { DirtyKey, LayoutEdits, LengthKey, PositionMode } from "./types";

const LENGTH_KEYS: LengthKey[] = ["top", "left", "right", "bottom", "width", "height"];

/** Convierte un valor CSS computado a px numéricos, o null si es `auto`/no-px. */
function pxOrNull(value: string): number | null {
  if (!value || value === "auto" || value === "none") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) && value.trim().endsWith("px") ? Math.round(n) : null;
}

/** Lee el estado editable ACTUAL de un elemento desde el DOM.
 *  - position / longitudes: del estilo computado.
 *  - transform: intenta descomponer la matriz computada en
 *    translate + scale + rotate (suficiente para transforms 2D simples). */
export function readEdits(el: HTMLElement): LayoutEdits {
  const cs = getComputedStyle(el);
  const t = decomposeTransform(cs.transform);
  return {
    position: (cs.position as PositionMode) || "static",
    top: pxOrNull(cs.top),
    left: pxOrNull(cs.left),
    right: pxOrNull(cs.right),
    bottom: pxOrNull(cs.bottom),
    width: Math.round(parseFloat(cs.width)) || null,
    height: Math.round(parseFloat(cs.height)) || null,
    scale: t.scale,
    rotateX: 0,
    rotateY: 0,
    rotateZ: t.rotate,
    translateX: t.translateX,
    translateY: t.translateY,
    perspective: 0,
  };
}

/** Descompone una matriz `matrix(a,b,c,d,e,f)` 2D en sus partes.
 *  (Para transforms 3D/complejas cae a valores por defecto — el editor
 *  recompone siempre en el orden translate→rotate→scale.) */
function decomposeTransform(transform: string): {
  scale: number;
  rotate: number;
  translateX: number;
  translateY: number;
} {
  const def = { scale: 1, rotate: 0, translateX: 0, translateY: 0 };
  if (!transform || transform === "none") return def;
  const m = transform.match(/matrix\(([^)]+)\)/);
  if (!m) return def;
  const [a, b, , d, e, f] = m[1].split(",").map((v) => parseFloat(v));
  if ([a, b, d, e, f].some((v) => !Number.isFinite(v))) return def;
  const scale = Math.round(Math.hypot(a, b) * 1000) / 1000 || 1;
  const rotate = Math.round((Math.atan2(b, a) * 180) / Math.PI);
  return { scale, rotate, translateX: Math.round(e), translateY: Math.round(f) };
}

/** Arma el string `transform` a partir de las partes (orden estable).
 *  `perspective()` debe ir PRIMERO para que rotateX/rotateY tengan profundidad. */
export function composeTransform(e: LayoutEdits): string {
  const parts: string[] = [];
  if (e.perspective > 0) parts.push(`perspective(${e.perspective}px)`);
  if (e.translateX !== 0 || e.translateY !== 0) parts.push(`translate(${e.translateX}px, ${e.translateY}px)`);
  if (e.rotateX !== 0) parts.push(`rotateX(${e.rotateX}deg)`);
  if (e.rotateY !== 0) parts.push(`rotateY(${e.rotateY}deg)`);
  if (e.rotateZ !== 0) parts.push(`rotateZ(${e.rotateZ}deg)`);
  if (e.scale !== 1) parts.push(`scale(${round(e.scale)})`);
  return parts.join(" ");
}

/** ¿Algún offset (top/left/right/bottom) está definido? */
function hasOffsets(e: LayoutEdits): boolean {
  return e.top !== null || e.left !== null || e.right !== null || e.bottom !== null;
}

/** Position EFECTIVA: si hay offsets pero el modo es `static`, los offsets no
 *  harían nada → se promueve a `relative` (tanto al aplicar como en el CSS). */
export function effectivePosition(e: LayoutEdits): PositionMode {
  if (e.position !== "static") return e.position;
  return hasOffsets(e) ? "relative" : "static";
}

/** Aplica al DOM SÓLO las propiedades marcadas como dirty, y con `!important`.
 *
 *  Por qué así (corrige el bug de "se devuelve a su posición"):
 *  - Sólo tocamos lo que el usuario editó → no pisamos el esquema de layout
 *    original del elemento (p. ej. `left/top` en % o el centrado por la
 *    propiedad CSS `translate`).
 *  - `!important` evita que estilos de hoja/clase reescriban el preview. (Si
 *    la app reasigna `style.left` en un re-render igual nos ganaría, por eso
 *    el controlador además re-asienta con un MutationObserver.) */
export function applyEdits(el: HTMLElement, e: LayoutEdits, dirty: Set<DirtyKey>): void {
  if (dirty.has("position")) {
    const pos = effectivePosition(e);
    if (pos === "static") el.style.removeProperty("position");
    else el.style.setProperty("position", pos, "important");
  }
  for (const key of LENGTH_KEYS) {
    if (!dirty.has(key)) continue;
    const v = e[key];
    if (v === null) el.style.removeProperty(key);
    else el.style.setProperty(key, `${v}px`, "important");
  }
  if (dirty.has("transform")) {
    const t = composeTransform(e);
    if (t) el.style.setProperty("transform", t, "important");
    else el.style.removeProperty("transform");
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Serializa a CSS SÓLO lo que el usuario editó (dirty) — requisito 4. */
export function generateCss(el: HTMLElement, e: LayoutEdits, dirty: Set<DirtyKey>): string {
  const selector = buildSelector(el);
  const lines: string[] = [];
  // Emitimos `position` siempre que haya ALGÚN cambio y el elemento esté
  // posicionado (absolute/relative/fixed/sticky), no sólo al tocar offsets.
  // Así la regla es autosuficiente: pegada en el .css funciona sola
  // (p. ej. un mover con translate() necesita que el botón sea `absolute`).
  const pos = effectivePosition(e);
  if (dirty.size > 0 && pos !== "static") lines.push(`position: ${pos};`);
  for (const key of LENGTH_KEYS) {
    if (!dirty.has(key)) continue;
    const v = e[key];
    if (v !== null) lines.push(`${key}: ${v}px;`);
  }
  if (dirty.has("transform")) {
    const transform = composeTransform(e);
    if (transform) lines.push(`transform: ${transform};`);
  }

  if (lines.length === 0) return `${selector} {\n  /* movés un elemento o editás un valor para ver el CSS */\n}`;
  return `${selector} {\n${lines.map((l) => `  ${l}`).join("\n")}\n}`;
}

/** Copia texto al portapapeles, con fallback para contextos no seguros. */
export async function copyToClipboard(text: string): Promise<boolean> {
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
