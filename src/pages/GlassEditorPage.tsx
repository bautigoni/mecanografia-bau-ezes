import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, RotateCcw, Check } from "lucide-react";
import { assets } from "../utils/assets";

/* =====================================================================
   Liquid-glass editor (superadmin / dev only).

   Tweaks the global --glass-* CSS variables LIVE on :root so you can dial
   in how "liquid" the glassmorphism feels across the whole app. Values are
   remembered in localStorage and re-applied on boot (see applyStoredGlass).
   Copy the values and paste them into the :root block in global.css to make
   them the new defaults.
===================================================================== */

interface GlassVars {
  blur: number;       // px
  saturate: number;   // multiplier
  white: number;      // 0..1
  border: number;     // 0..1
  sheen: number;      // 0..1
  modalBlur: number;  // px — difuminado del fondo detrás de popups
  modalTint: number;  // 0..1 — oscurecido del fondo detrás de popups
}

const DEFAULTS: GlassVars = { blur: 26, saturate: 1.6, white: 0.55, border: 0.65, sheen: 0.6, modalBlur: 22, modalTint: 0.16 };
const STORAGE_KEY = "typely.glassEditor.v1";
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Apply the vars to :root. Exported so main.tsx can call it on boot. */
export function applyGlassVars(v: GlassVars) {
  const r = document.documentElement.style;
  r.setProperty("--glass-blur", `${v.blur}px`);
  r.setProperty("--glass-saturate", String(v.saturate));
  r.setProperty("--glass-white", String(v.white));
  r.setProperty("--glass-border", String(v.border));
  r.setProperty("--glass-sheen", String(v.sheen));
  r.setProperty("--modal-blur", `${v.modalBlur}px`);
  r.setProperty("--modal-tint", String(v.modalTint));
}

/** Read saved glass vars (if any) and apply them — call once at app start. */
export function applyStoredGlass() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) applyGlassVars({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<GlassVars>) });
  } catch {
    /* ignore */
  }
}

export function GlassEditorPage() {
  const navigate = useNavigate();
  const [v, setV] = useState<GlassVars>(DEFAULTS);
  const [copied, setCopied] = useState(false);
  const [showModalPreview, setShowModalPreview] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setV({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<GlassVars>) });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    applyGlassVars(v);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
  }, [v]);

  const cssBlock =
    `:root {\n` +
    `  --glass-blur: ${round2(v.blur)}px;\n` +
    `  --glass-saturate: ${round2(v.saturate)};\n` +
    `  --glass-white: ${round2(v.white)};\n` +
    `  --glass-border: ${round2(v.border)};\n` +
    `  --glass-sheen: ${round2(v.sheen)};\n` +
    `  --modal-blur: ${round2(v.modalBlur)}px;\n` +
    `  --modal-tint: ${round2(v.modalTint)};\n` +
    `}`;

  function copy() {
    navigator.clipboard?.writeText(cssBlock).then(
      () => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); },
      () => { /* clipboard blocked */ },
    );
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url("${assets.gameplayBg}")` }}
    >
      {/* Live preview cards over the busy art so you can judge the glass. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
        <div className="glass-card-smooth p-10 flex flex-col items-center gap-3 w-[min(28rem,90vw)]">
          <span className="text-sm font-bold text-muted uppercase tracking-wide">Objetivo 1 / 7</span>
          <strong className="font-display font-black text-text text-7xl">A</strong>
        </div>
        <div className="glass-strong px-6 py-3 rounded-2xl">
          <span className="font-display font-bold text-text text-lg">Presioná la letra que aparece</span>
        </div>
        <div className="flex gap-3">
          <span className="glass-surface px-4 py-2 rounded-xl font-bold text-text">glass-surface</span>
          <span className="glass px-4 py-2 rounded-xl font-bold text-text">glass</span>
        </div>
      </div>

      {/* Control panel */}
      <aside className="absolute top-4 right-4 z-30 w-[min(22rem,92vw)] glass-card-smooth p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold text-text">Editor liquid-glass</h1>
          <button
            type="button"
            onClick={() => navigate("/entrar")}
            className="flex items-center gap-1.5 text-sm font-bold text-muted hover:text-text transition cursor-pointer"
          >
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
        <p className="text-xs text-muted -mt-2">
          Movés los sliders y el glass de toda la app cambia en vivo. Cuando te
          guste, copiá los valores y los dejo como default.
        </p>

        <Slider label="Blur (px)" value={v.blur} min={0} max={60} step={1} onChange={(blur) => setV((s) => ({ ...s, blur }))} />
        <Slider label="Saturación" value={v.saturate} min={1} max={3} step={0.05} onChange={(saturate) => setV((s) => ({ ...s, saturate }))} />
        <Slider label="Blanco (opacidad)" value={v.white} min={0} max={0.9} step={0.01} onChange={(white) => setV((s) => ({ ...s, white }))} />
        <Slider label="Borde" value={v.border} min={0} max={1} step={0.01} onChange={(border) => setV((s) => ({ ...s, border }))} />
        <Slider label="Brillo (sheen)" value={v.sheen} min={0} max={1} step={0.01} onChange={(sheen) => setV((s) => ({ ...s, sheen }))} />

        <div className="h-px bg-white/40 my-1" />
        <p className="text-[11px] font-bold text-accent-strong -mb-1">Popups / modales (fondo)</p>
        <Slider label="Difuminado fondo" value={v.modalBlur} min={0} max={60} step={1} onChange={(modalBlur) => setV((s) => ({ ...s, modalBlur }))} />
        <Slider label="Oscurecido fondo" value={v.modalTint} min={0} max={0.6} step={0.01} onChange={(modalTint) => setV((s) => ({ ...s, modalTint }))} />

        <pre className="text-[11px] leading-snug text-accent-strong bg-white/50 rounded-lg p-2 overflow-x-auto no-scrollbar">{cssBlock}</pre>

        <button
          type="button"
          onClick={() => setShowModalPreview(true)}
          className="py-2.5 rounded-xl font-bold text-text bg-white/55 hover:bg-white/80 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Ver popup de ejemplo
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "¡Copiado!" : "Copiar CSS"}
          </button>
          <button
            type="button"
            onClick={() => setV(DEFAULTS)}
            className="flex items-center justify-center px-4 py-2.5 rounded-xl font-bold text-text bg-white/50 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Restablecer"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </aside>

      {/* Popup de ejemplo — usa exactamente las mismas clases que los modales
          reales (.modal-overlay + .modal-card) para juzgar el difuminado. */}
      {showModalPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade" role="dialog" aria-modal="true">
          <div className="modal-overlay" onClick={() => setShowModalPreview(false)} />
          <div className="glass-card-smooth modal-card relative p-8 w-[min(26rem,92vw)] flex flex-col gap-4 animate-card-pop">
            <h2 className="font-display text-xl font-bold text-text">Popup de ejemplo</h2>
            <p className="text-muted font-semibold text-sm">
              Así se ve el difuminado del fondo detrás de los modales. Movés
              «Difuminado fondo» y «Oscurecido fondo» y se actualiza en vivo.
            </p>
            <button
              type="button"
              onClick={() => setShowModalPreview(false)}
              className="self-start px-5 py-2.5 rounded-xl font-extrabold text-white bg-gradient-to-br from-accent-sky to-accent-strong cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-muted">
      <span className="w-32 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent-strong cursor-pointer"
      />
      <span className="w-12 text-right text-text tabular-nums">{round2(value)}</span>
    </label>
  );
}
