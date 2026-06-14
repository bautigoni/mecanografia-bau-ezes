/* =====================================================================
   Developer Layout Editor — tipos compartidos.

   Herramienta interna SOLO de desarrollo: editar visualmente posición,
   tamaño, escala, rotación y traslación de cualquier elemento del frontend
   y exportar el CSS equivalente. No se incluye en el bundle de producción
   (ver DevLayoutEditorMount.tsx — doble compuerta import.meta.env.DEV +
   VITE_ENABLE_LAYOUT_EDITOR).
   ===================================================================== */

/** Modos de `position` que el panel permite elegir. */
export type PositionMode = "static" | "relative" | "absolute" | "fixed" | "sticky";

/** Conjunto editable de propiedades de un elemento.
 *  Las longitudes se guardan en píxeles (`number`) o `null` = sin definir
 *  (se trata como `auto`, no se emite en el CSS). Las propiedades de
 *  `transform` se guardan ya descompuestas (no como matriz). */
export interface LayoutEdits {
  position: PositionMode;
  top: number | null;
  left: number | null;
  right: number | null;
  bottom: number | null;
  width: number | null;
  height: number | null;
  /** 1 = sin escalar. */
  scale: number;
  /** grados, 0 = sin rotar. Rotación 3D por eje. */
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  /** px, 0 = sin trasladar. */
  translateX: number;
  translateY: number;
  /** px de profundidad para que rotateX/rotateY se vean en 3D. 0 = sin
   *  perspectiva (la rotación X/Y queda "plana"). Valores típicos 400–800. */
  perspective: number;
}

/** Claves de longitud (las que se editan en px y pueden ser `null`). */
export type LengthKey = "top" | "left" | "right" | "bottom" | "width" | "height";

/** Propiedades que el editor puede marcar como "tocadas" (dirty). Sólo las
 *  dirty se aplican al DOM y se exportan al CSS — así NO pisamos el esquema de
 *  layout original del elemento (p. ej. `left/top` en %) si el usuario no lo
 *  editó. `transform` agrupa scale/rotate/translateX/translateY. */
export type DirtyKey = LengthKey | "position" | "transform";

/** Claves numéricas de transform. */
export type TransformKey =
  | "scale"
  | "rotateX"
  | "rotateY"
  | "rotateZ"
  | "translateX"
  | "translateY"
  | "perspective";

/** Rectángulo en coordenadas de viewport (lo que devuelve getBoundingClientRect,
 *  ya redondeado para comparaciones estables entre frames). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
