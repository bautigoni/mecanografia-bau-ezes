import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { skinUrl } from "../../utils/assets";
import { getSkinPhaseIndex, SKIN_PHASE_THRESHOLDS } from "../../utils/progress";

/* Barra de "suma de estrellas" que vive DENTRO del modal de nivel completado.
 * Recibe el total de estrellas ANTES y DESPUÉS de completar el nivel y anima
 * el llenado del tramo del personaje desde `before` hasta `after`, con el
 * número subiendo y un "+N ⭐". Si el alumno cruza a una fase nueva, llena el
 * tramo al 100% y avisa por `onCrossPhase(nuevaFase)` — el padre dispara ahí
 * la celebración épica de personaje nuevo (después de esta barra).
 *
 * Mantiene el lenguaje visual de la barra grande (orbes con aro de luz,
 * relleno dorado con sheen + cometa, puntos de evolución) pero en versión
 * compacta para el modal. */

const SEEN_STARS_KEY = "edutic_skin_seen_stars_v1";
const TOTAL_PHASES = SKIN_PHASE_THRESHOLDS.length;

function prefersReduced(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** % del tramo de `phase` que cubre `total` (100 en fase máxima). */
function segPct(total: number, phase: number): number {
  const prev = SKIN_PHASE_THRESHOLDS[phase];
  const next = SKIN_PHASE_THRESHOLDS[phase + 1];
  if (next === undefined) return 100; // fase máxima
  return Math.max(0, Math.min(100, ((total - prev) / (next - prev)) * 100));
}

export function LevelStarReward({
  before,
  after,
  onCrossPhase,
}: {
  before: number;
  after: number;
  onCrossPhase?: (newPhase: number) => void;
}) {
  const phaseBefore = getSkinPhaseIndex(before);
  const phaseAfter = getSkinPhaseIndex(after);
  const crossing = phaseAfter > phaseBefore;
  const isMaxPhase = SKIN_PHASE_THRESHOLDS[phaseBefore + 1] === undefined;
  const nextThreshold = isMaxPhase ? null : SKIN_PHASE_THRESHOLDS[phaseBefore + 1];
  const gained = Math.max(0, after - before);

  const startPct = segPct(before, phaseBefore);
  const endPct = crossing ? 100 : segPct(after, phaseBefore);
  /* Conteo mostrado dentro del tramo: arranca en `before` y termina en `after`
     (acotado al umbral si cruza, para mostrar "30/30" antes de la celebración). */
  const endShownTotal = nextThreshold === null ? after : Math.min(after, nextThreshold);

  const [pct, setPct] = useState(startPct);
  const [instant, setInstant] = useState(true);
  const [shownTotal, setShownTotal] = useState(before);
  const [gaining, setGaining] = useState(false);
  const [badgeIn, setBadgeIn] = useState(false);
  const timers = useRef<number[]>([]);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    /* El hub ya no debe re-animar esta ganancia: dejamos el "visto" en `after`. */
    localStorage.setItem(SEEN_STARS_KEY, String(after));

    if (gained <= 0) {
      // Nada nuevo que sumar (repetición sin mejorar): no animamos ni celebramos.
      return;
    }

    const reduced = prefersReduced();
    const startDelay = reduced ? 0 : 650; // dejar que las estrellas del nivel "aterricen"
    const fillDur = reduced ? 0 : 1100; // = transición CSS de .skin-bar-fill

    const at = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };

    setBadgeIn(true);

    at(() => {
      setInstant(false);
      setGaining(true);
      setPct(endPct);
      if (reduced) {
        setShownTotal(endShownTotal);
      } else {
        let t0: number | null = null;
        const tick = (t: number) => {
          if (t0 === null) t0 = t;
          const k = Math.min(1, (t - t0) / fillDur);
          const eased = 1 - Math.pow(1 - k, 3);
          setShownTotal(Math.round(before + (endShownTotal - before) * eased));
          if (k < 1) rafId.current = requestAnimationFrame(tick);
          else setShownTotal(endShownTotal);
        };
        rafId.current = requestAnimationFrame(tick);
      }
    }, startDelay);

    at(() => setGaining(false), startDelay + fillDur + 300);
    /* Beat extra antes de la celebración: que se vea la barra llena al 100%
       (cuando cruza de fase) antes de que el personaje nuevo tape el modal. */
    at(() => { if (crossing) onCrossPhase?.(phaseAfter); }, startDelay + fillDur + (reduced ? 200 : 600));

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gained <= 0) return null;

  const mysteryPhase = nextThreshold === null ? phaseBefore : phaseBefore + 1;

  return (
    <div
      className="w-full glass-surface rounded-2xl px-4 py-3 flex flex-col gap-2 animate-mission-rise"
      style={{ animationDelay: "350ms" }}
      role="img"
      aria-label={`Sumaste ${gained} estrellas a tu colección, llevás ${after}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display font-bold uppercase tracking-[0.14em] text-[0.64rem] text-accent-strong/80">
          {isMaxPhase ? "Tu colección de estrellas" : "Próximo personaje"}
        </span>
        <span
          className={`inline-flex items-center gap-1 font-display font-black text-amber-500 text-sm ${badgeIn ? "animate-star-bounce" : "opacity-0"}`}
        >
          +{gained}
          <Star className="w-4 h-4 text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]" fill="currentColor" strokeWidth={1.5} />
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Orbe del personaje actual */}
        <span className="relative grid place-items-center shrink-0 w-11 h-11">
          <span className="skin-orb-ring absolute inset-0 rounded-full animate-sparkle-spin blur-[1px]" aria-hidden="true" />
          <span className="relative w-[84%] h-[84%] rounded-full bg-white/75 border border-white/85 grid place-items-center overflow-hidden shadow-inner">
            <img src={skinUrl("male", phaseBefore)} alt="" decoding="async" className="w-[82%] h-[82%] object-contain drop-shadow-sm" />
          </span>
        </span>

        {/* Riel + cometa */}
        <div className="relative flex-1">
          <span className="block h-3.5 rounded-full bg-white/45 border border-white/60 overflow-hidden shadow-inner">
            <span
              className={`skin-bar-fill block h-full rounded-full ${gaining ? "animate-skin-bar-gain" : ""}`}
              style={{ width: `${pct}%`, ...(instant ? { transition: "none" } : null) }}
            />
          </span>
          {pct > 0 && pct < 100 && (
            <span
              className="skin-bar-tip"
              style={{ left: `${pct}%`, ...(instant ? { transition: "none" } : null) }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Orbe misterioso (próxima fase) / personaje final en fase máxima */}
        <span className="relative grid place-items-center shrink-0 w-11 h-11">
          <span className="skin-orb-ring absolute inset-0 rounded-full animate-sparkle-spin blur-[1px]" aria-hidden="true" />
          <span className="relative w-[84%] h-[84%] rounded-full bg-white/75 border border-white/85 grid place-items-center overflow-hidden shadow-inner">
            <img
              src={skinUrl("male", mysteryPhase)}
              alt=""
              decoding="async"
              className={`w-[82%] h-[82%] object-contain ${nextThreshold === null ? "drop-shadow-sm" : "brightness-0 opacity-80"}`}
            />
            {nextThreshold !== null && (
              <span className="absolute inset-0 grid place-items-center font-display font-black text-white text-lg animate-mystery-pulse" aria-hidden="true">
                ?
              </span>
            )}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: TOTAL_PHASES }, (_, i) => (
            <span
              key={i}
              className={
                i <= phaseBefore
                  ? "w-2 h-2 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_6px_rgba(250,204,21,0.8)]"
                  : "w-2 h-2 rounded-full bg-white/50 border border-white/70"
              }
            />
          ))}
        </div>
        <span className="flex items-center gap-1 font-display font-black text-text text-sm tabular-nums leading-none">
          {nextThreshold === null ? shownTotal : `${shownTotal}/${nextThreshold}`}
          <Star className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_1px_2px_rgba(250,204,21,0.7)]" fill="currentColor" strokeWidth={1.5} />
        </span>
      </div>
    </div>
  );
}
