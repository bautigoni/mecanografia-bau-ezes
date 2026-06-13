/* =====================================================================
   styles — CSS autocontenido del editor (inyectado como <style> dentro del
   portal). Todo va scopeado bajo `.dle-root` para no chocar con la app ni
   depender de Tailwind. Estética oscura tipo Figma / Chrome DevTools.

   z-index altísimo: el overlay debe quedar por encima de TODO (modales de la
   app usan z-50/55/60). pointer-events se controla por elemento.
   ===================================================================== */

export const EDITOR_CSS = `
.dle-root {
  --dle-accent: #4c8dff;
  --dle-accent-2: #ff5fa2;
  --dle-bg: #11141c;
  --dle-bg-soft: #1b2030;
  --dle-line: #2c3346;
  --dle-text: #e7ecf6;
  --dle-muted: #8b96ad;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none; /* el contenedor deja pasar; sólo el panel captura */
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.dle-root * { box-sizing: border-box; }

/* ── Cajas de resaltado (hover / selección) ── */
.dle-box {
  position: fixed;
  pointer-events: none;
  border-radius: 3px;
  will-change: transform, width, height;
}
.dle-box-hover { border: 1.5px dashed rgba(76, 141, 255, 0.7); background: rgba(76, 141, 255, 0.06); }
.dle-box-sel {
  border: 1.5px solid var(--dle-accent);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.25), 0 0 16px rgba(76,141,255,0.45);
  background: rgba(76, 141, 255, 0.04);
}
/* Manijas decorativas en las esquinas de la selección. */
.dle-handle {
  position: absolute;
  width: 8px; height: 8px;
  background: #fff;
  border: 1.5px solid var(--dle-accent);
  border-radius: 2px;
}
.dle-handle.tl { top: -5px; left: -5px; }
.dle-handle.tr { top: -5px; right: -5px; }
.dle-handle.bl { bottom: -5px; left: -5px; }
.dle-handle.br { bottom: -5px; right: -5px; }

/* Etiqueta de coordenadas/medidas. */
.dle-tag {
  position: fixed;
  pointer-events: none;
  font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #fff;
  background: var(--dle-accent);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}
.dle-tag-size { background: #20283a; color: var(--dle-text); border: 1px solid var(--dle-line); }

/* Guías que cruzan el viewport por los bordes del elemento. */
.dle-guide { position: fixed; pointer-events: none; background: rgba(255, 95, 162, 0.55); }
.dle-guide.h { left: 0; right: 0; height: 1px; }
.dle-guide.v { top: 0; bottom: 0; width: 1px; }

/* ── Panel flotante (DevTools-like) ── */
.dle-panel {
  position: fixed;
  width: 280px;
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  background: var(--dle-bg);
  color: var(--dle-text);
  border: 1px solid var(--dle-line);
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.5);
  overflow: hidden;
  font-size: 12px;
}
.dle-header {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 10px;
  background: var(--dle-bg-soft);
  border-bottom: 1px solid var(--dle-line);
  cursor: grab;
  user-select: none;
}
.dle-header:active { cursor: grabbing; }
.dle-title { font-weight: 700; letter-spacing: 0.02em; display: flex; align-items: center; gap: 6px; }
.dle-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--dle-accent); box-shadow: 0 0 8px var(--dle-accent); }
.dle-spacer { flex: 1; }
.dle-x {
  all: unset; cursor: pointer; width: 22px; height: 22px;
  display: grid; place-items: center; border-radius: 6px; color: var(--dle-muted);
}
.dle-x:hover { background: rgba(255,255,255,0.08); color: var(--dle-text); }

.dle-body { padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }

.dle-selector {
  font: 600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #9fd0ff;
  background: var(--dle-bg-soft);
  border: 1px solid var(--dle-line);
  border-radius: 7px;
  padding: 6px 8px;
  word-break: break-all;
}
.dle-empty { color: var(--dle-muted); text-align: center; padding: 18px 8px; line-height: 1.6; }
.dle-kbd {
  font: 600 11px/1 ui-monospace, monospace;
  background: var(--dle-bg-soft); border: 1px solid var(--dle-line);
  border-bottom-width: 2px; border-radius: 5px; padding: 2px 5px; color: var(--dle-text);
}

.dle-row { display: flex; align-items: center; gap: 6px; }
.dle-row > label { color: var(--dle-muted); min-width: 58px; }
.dle-select, .dle-input {
  all: unset;
  flex: 1;
  background: var(--dle-bg-soft);
  border: 1px solid var(--dle-line);
  border-radius: 6px;
  padding: 5px 7px;
  color: var(--dle-text);
  font: 500 12px/1 ui-monospace, monospace;
  min-width: 0;
}
.dle-input:focus, .dle-select:focus { border-color: var(--dle-accent); }
.dle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.dle-field { display: flex; flex-direction: column; gap: 3px; }
.dle-field > span { color: var(--dle-muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }

.dle-actions { display: flex; gap: 6px; }
.dle-btn {
  all: unset; cursor: pointer; text-align: center;
  flex: 1; padding: 8px 10px; border-radius: 8px; font-weight: 700; font-size: 12px;
  background: var(--dle-bg-soft); border: 1px solid var(--dle-line); color: var(--dle-text);
}
.dle-btn:hover { border-color: var(--dle-muted); }
.dle-btn-primary {
  background: linear-gradient(135deg, var(--dle-accent), #6f5cff);
  border-color: transparent; color: #fff;
}
.dle-btn-primary:hover { filter: brightness(1.08); }

.dle-pre {
  margin: 0;
  background: #0a0d14;
  border: 1px solid var(--dle-line);
  border-radius: 8px;
  padding: 8px 10px;
  color: #c7f0d8;
  font: 500 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre;
  overflow: auto;
  max-height: 150px;
}
.dle-hint { color: var(--dle-muted); font-size: 10.5px; text-align: center; }

/* Toast de confirmación de copiado. */
.dle-toast {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  pointer-events: none;
  background: #14351f;
  color: #b6f3c9;
  border: 1px solid #2f6b45;
  padding: 9px 16px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  animation: dle-toast-in 160ms ease both;
}
@keyframes dle-toast-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* Aviso flotante cuando el editor está activo pero sin nada seleccionado. */
.dle-mode-pill {
  position: fixed;
  left: 50%; top: 14px; transform: translateX(-50%);
  pointer-events: none;
  background: var(--dle-bg); color: var(--dle-text);
  border: 1px solid var(--dle-line);
  padding: 7px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  display: flex; align-items: center; gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .dle-toast { animation-duration: 1ms; }
}
`;
