import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { skinUrl } from "../../utils/assets";
import { getSkinPhaseProgress, type SkinPhaseProgress } from "../../utils/progress";

/* Progreso hacia el PRÓXIMO personaje (fase de skin por estrellas).
 *
 * Pill de vidrio con: el personaje actual, la barra dorada del tramo de fase
 * en curso, el conteo "27/30 ⭐" y el personaje misterioso (la silueta REAL
 * de la próxima fase, ennegrecida con filter + un "?" brillante — siempre es
 * un teaser verdadero del personaje que viene).
 *
 * Animación de llenado: el último total VISTO queda en localStorage; al
 * montar, la barra se dibuja en ese valor y transiciona hasta el total real,
 * así las estrellas ganadas desde la última visita se ven "entrar". También
 * escucha edutic:progress para subir en vivo. Al cruzar de fase la barra
 * arranca un tramo nuevo: salta a 0 sin animar hacia atrás y llena de nuevo
 * (la celebración de desbloqueo cubre ese momento). */

const SEEN_STARS_KEY = "edutic_skin_seen_stars_v1";

function readSeenStars(): number {
  const n = Number(localStorage.getItem(SEEN_STARS_KEY));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** % del tramo de la fase actual que cubre `stars` (100 en fase máxima). */
function segmentPct(p: SkinPhaseProgress, stars: number): number {
  if (p.isMax || p.nextThreshold === null) return 100;
  const span = p.nextThreshold - p.prevThreshold;
  return Math.max(0, Math.min(100, ((stars - p.prevThreshold) / span) * 100));
}

export function SkinProgressBar({ className = "" }: { className?: string }) {
  const [prog, setProg] = useState(() => getSkinPhaseProgress());
  const [pct, setPct] = useState(() =>
    segmentPct(getSkinPhaseProgress(), Math.min(readSeenStars(), getSkinPhaseProgress().totalStars)),
  );
  const [gaining, setGaining] = useState(false);
  /* Primer pintado sin transición (la barra aparece YA en el valor visto). */
  const [instant, setInstant] = useState(true);
  const phaseRef = useRef(prog.phaseIndex);
  const gainTimer = useRef<number | null>(null);

  useEffect(() => {
    const pulse = () => {
      setGaining(true);
      if (gainTimer.current !== null) window.clearTimeout(gainTimer.current);
      gainTimer.current = window.setTimeout(() => setGaining(false), 2200);
    };

    /* Tras el primer pintado: animar desde el valor visto hasta el real. */
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setInstant(false);
        const current = getSkinPhaseProgress();
        const target = segmentPct(current, current.totalStars);
        setPct((drawn) => {
          if (target > drawn) pulse();
          return target;
        });
        localStorage.setItem(SEEN_STARS_KEY, String(current.totalStars));
      }),
    );

    const update = () => {
      const next = getSkinPhaseProgress();
      setProg(next);
      localStorage.setItem(SEEN_STARS_KEY, String(next.totalStars));
      if (next.phaseIndex !== phaseRef.current) {
        /* Fase nueva → tramo nuevo: snap a 0 (sin animar hacia atrás) y llenar. */
        const grewPhase = next.phaseIndex > phaseRef.current;
        phaseRef.current = next.phaseIndex;
        setInstant(true);
        setPct(0);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setInstant(false);
            /* Releer fresco: si llegó OTRO evento mientras este rAF estaba
               pendiente, el snapshot capturado quedaría viejo y pisaría el
               valor más nuevo. */
            const fresh = getSkinPhaseProgress();
            setPct(segmentPct(fresh, fresh.totalStars));
            if (grewPhase) pulse();
          }),
        );
      } else {
        setPct((drawn) => {
          const target = segmentPct(next, next.totalStars);
          if (target > drawn) pulse();
          return target;
        });
      }
    };
    window.addEventListener("edutic:progress", update);
    window.addEventListener("storage", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("edutic:progress", update);
      window.removeEventListener("storage", update);
      if (gainTimer.current !== null) window.clearTimeout(gainTimer.current);
    };
  }, []);

  const mysteryPhase = prog.isMax ? prog.phaseIndex : prog.phaseIndex + 1;
  const ariaLabel = prog.isMax
    ? `Personajes al máximo nivel con ${prog.totalStars} estrellas`
    : `Llevás ${prog.totalStars} de ${prog.nextThreshold} estrellas para el próximo personaje`;

  return (
    <div
      className={[
        "glass-strong flex items-center gap-2.5 rounded-full pl-1.5 pr-1.5 py-1.5",
        "shadow-md border border-white/60 select-none pointer-events-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {/* Personaje actual */}
      <span className="w-10 h-10 rounded-full bg-white/55 border border-white/70 grid place-items-center overflow-hidden shrink-0">
        <img
          src={skinUrl("male", prog.phaseIndex)}
          alt=""
          decoding="async"
          className="w-8 h-8 object-contain drop-shadow-sm"
        />
      </span>

      {/* Barra del tramo actual + conteo */}
      <div className="flex flex-col gap-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="relative block w-24 sm:w-32 h-3 rounded-full bg-white/45 border border-white/60 overflow-hidden">
            <span
              className={`skin-bar-fill absolute inset-y-0 left-0 rounded-full ${gaining ? "animate-skin-bar-gain" : ""}`}
              style={{ width: `${pct}%`, ...(instant ? { transition: "none" } : null) }}
            />
          </span>
          <span className="flex items-center gap-0.5 font-display font-bold text-text text-xs leading-none tabular-nums whitespace-nowrap">
            {prog.isMax ? prog.totalStars : `${prog.totalStars}/${prog.nextThreshold}`}
            <Star
              size={13}
              strokeWidth={1.5}
              className="text-amber-400 drop-shadow-[0_1px_2px_rgba(250,204,21,0.7)]"
              fill="currentColor"
            />
          </span>
        </div>
        <span className="text-[10px] leading-none font-semibold text-muted whitespace-nowrap">
          {prog.isMax ? "¡Personajes al máximo!" : "Próximo personaje"}
        </span>
      </div>

      {/* Personaje misterioso: silueta real de la próxima fase + "?" */}
      <span className="relative w-10 h-10 rounded-full bg-white/55 border border-white/70 grid place-items-center overflow-hidden shrink-0">
        <img
          src={skinUrl("male", mysteryPhase)}
          alt=""
          decoding="async"
          className={`w-8 h-8 object-contain ${prog.isMax ? "drop-shadow-sm" : "brightness-0 opacity-80"}`}
        />
        {!prog.isMax && (
          <span
            className="absolute inset-0 grid place-items-center font-display font-bold text-white text-base animate-mystery-pulse"
            aria-hidden="true"
          >
            ?
          </span>
        )}
      </span>
    </div>
  );
}
