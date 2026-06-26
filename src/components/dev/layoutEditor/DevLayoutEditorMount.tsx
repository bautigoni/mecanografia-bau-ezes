import { lazy, Suspense, type ComponentType } from "react";

/* =====================================================================
   DevLayoutEditorMount — ÚNICO punto de entrada del editor para la app.

   Doble compuerta (requisito 1):
     1. import.meta.env.DEV               → sólo en `vite dev`, nunca en build.
     2. VITE_ENABLE_LAYOUT_EDITOR === 'true'  → flag explícito por entorno.

   Exclusión de PRODUCCIÓN garantizada: en `vite build`, import.meta.env.DEV
   se reemplaza por la constante `false`, por lo que el bloque `if` es código
   muerto y Rollup elimina TAMBIÉN el `import('./DevLayoutEditor')` dinámico
   → el chunk del editor NO se emite, NO se descarga y NO registra ningún
   listener en producción.

   En desarrollo, si el flag está apagado, se renderiza `null` (sin overlay).
   ===================================================================== */

const ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_LAYOUT_EDITOR === "true";

// El import dinámico vive DENTRO del guard DEV para que el bundler de
// producción lo descarte por completo (tree-shaking de rama muerta).
let LazyEditor: ComponentType | null = null;
if (import.meta.env.DEV) {
  LazyEditor = lazy(() => import("./DevLayoutEditor"));
}

export function DevLayoutEditorMount() {
  if (!ENABLED || !LazyEditor) return null;
  const Editor = LazyEditor;
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  );
}
