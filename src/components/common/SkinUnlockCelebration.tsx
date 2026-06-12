import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "./Button";
import { skinUrl, type SkinKind } from "../../utils/assets";
import { getSkinPhaseIndex, SKIN_PHASE_THRESHOLDS } from "../../utils/progress";

/* Celebración al desbloquear una FASE de personaje nueva (por estrellas).
 *
 * Se monta en las pantallas "hub" (mapa de mundos / detalle de isla): cuando
 * la fase actual supera la última fase celebrada (persistida en localStorage),
 * aparece un modal de vidrio con los tres personajes (robots + nave)
 * revelándose con la misma animación mágica del desbloqueo de mundos
 * (unlock-reveal + chispas). Al cerrarlo se registra la fase como celebrada.
 *
 * Primera visita de una cuenta existente: se registra la fase actual SIN
 * celebrar (nada de festejos retroactivos). Si el progreso se reinicia
 * (demo "empezar de cero"), la fase celebrada se re-sincroniza hacia abajo. */

const CELEBRATED_KEY = "edutic_skin_phase_celebrated_v1";
const REVEAL_KINDS: SkinKind[] = ["female", "ship", "male"];
const BURST_COLORS = ["#c9b8ff", "#bff3ff", "#ffd9f1", "#fff8ff", "#ffe4b8", "#b8ffe4"];

function readCelebrated(): number | null {
  const raw = localStorage.getItem(CELEBRATED_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function SkinUnlockCelebration() {
  const [shownPhase, setShownPhase] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const phase = getSkinPhaseIndex();
      const celebrated = readCelebrated();
      if (celebrated === null || phase < celebrated) {
        localStorage.setItem(CELEBRATED_KEY, String(phase));
        return;
      }
      if (phase > celebrated) setShownPhase(phase);
    };
    check();
    window.addEventListener("edutic:progress", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("edutic:progress", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  /* Cerrar con Escape mientras está visible. */
  useEffect(() => {
    if (shownPhase === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownPhase]);

  if (shownPhase === null) return null;

  const dismiss = () => {
    localStorage.setItem(CELEBRATED_KEY, String(getSkinPhaseIndex()));
    setShownPhase(null);
  };

  const threshold = SKIN_PHASE_THRESHOLDS[shownPhase] ?? SKIN_PHASE_THRESHOLDS[SKIN_PHASE_THRESHOLDS.length - 1];

  return (
    /* z-[55]: por encima del stack fijo del mapa (z-50, contador + menú) pero
       por debajo del ImpersonationBanner global (z-[60]), que debe quedar
       siempre visible. */
    <div
      className="fixed inset-0 z-[55] grid place-items-center p-4 animate-overlay-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevos personajes desbloqueados"
    >
      <div className="modal-overlay" onClick={dismiss} />
      <div className="glass-card modal-card relative w-full max-w-md px-6 py-7 text-center animate-card-pop">
        {/* Chispas celebratorias (mismo burst que el desbloqueo de islas). */}
        <span className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {BURST_COLORS.map((color, i) => (
            <i
              key={i}
              className="absolute top-1/3 left-1/2 w-2.5 h-2.5 rounded-full animate-unlock-burst"
              style={{
                background: color,
                animationDelay: `${i * 0.08}s`,
                transform: `rotate(${i * 60}deg) translateY(-4.5rem)`,
              }}
            />
          ))}
        </span>

        <h2 className="font-display font-bold text-text text-[1.6rem] leading-tight m-0">
          ¡Tus personajes evolucionaron!
        </h2>
        <p className="text-muted font-semibold text-sm mt-1.5 mb-5">
          Ganaste suficientes estrellas y desbloqueaste sus nuevos trajes.
        </p>

        {/* Trío revelándose: robot mujer · nave · robot hombre. */}
        <div className="flex items-end justify-center gap-3 sm:gap-5 mb-5">
          {REVEAL_KINDS.map((kind, i) => (
            <span
              key={kind}
              className="animate-unlock-reveal"
              style={{ animationDelay: `${i * 0.18}s` }}
            >
              <img
                src={skinUrl(kind, shownPhase)}
                alt=""
                decoding="async"
                className={`object-contain drop-shadow-lg animate-mascot-float ${
                  kind === "ship" ? "w-20 sm:w-24" : "w-24 sm:w-28"
                }`}
                style={{ animationDelay: `${i * 0.5}s` }}
              />
            </span>
          ))}
        </div>

        <span className="glass-surface inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display font-bold text-text text-sm mb-5">
          <Star
            size={17}
            strokeWidth={1.5}
            className="text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]"
            fill="currentColor"
          />
          ¡Llegaste a {threshold} estrellas!
        </span>

        <Button className="w-full" onClick={dismiss} autoFocus>
          ¡Genial!
        </Button>
      </div>
    </div>
  );
}
