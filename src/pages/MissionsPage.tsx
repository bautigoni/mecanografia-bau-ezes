import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Flag,
  MapPin,
  Sparkles,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { assets } from "../utils/assets";
import { useAuth } from "../hooks/useAuth";
import { getUserContext } from "../utils/userContext";
import { activitiesByWorld, type Activity } from "../data/activities";
import {
  getCurrentLevelNumber,
  isLevelCompleted,
  loadProgress,
  type CurriculumProgress,
} from "../utils/progress";
import {
  getWorldStatesForUser,
  getWorldsForUser,
  worldStarProgress,
  type World,
  type WorldLockState,
} from "../data/worlds";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns the first not-yet-completed activity of the given world, so the
 *  "continue" button can deep-link straight into gameplay. Falls back to
 *  the very last activity if the world is already complete (so the user
 *  still has a clear CTA — "replay" — instead of a dead button). */
function currentActivityFor(
  worldId: Activity["worldId"],
  progress: CurriculumProgress,
): Activity | null {
  const activities = activitiesByWorld[worldId] ?? [];
  if (activities.length === 0) return null;
  const currentLevel = getCurrentLevelNumber(progress, worldId);
  const found = activities.find((a) => a.levelNumber === currentLevel);
  if (found) return found;
  return activities[activities.length - 1];
}

/** Aggregate progress across the worlds the user can see. */
function summarizeWorlds(worlds: World[], states: Record<string, WorldLockState>, progress: CurriculumProgress) {
  let completedWorlds = 0;
  let totalStars = 0;
  let possibleStars = 0;
  for (const w of worlds) {
    const starInfo = worldStarProgress(w.id, progress);
    totalStars += starInfo.earnedStars;
    possibleStars += starInfo.totalStars;
    if (states[w.slug] === "completed") completedWorlds += 1;
  }
  return {
    totalWorlds: worlds.length,
    completedWorlds,
    totalStars,
    possibleStars,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function MissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  /* Memoized reads: same pattern as WorldsPage so progress / world
     resolution is stable across re-renders. */
  const context = useMemo(() => getUserContext(user), [user]);
  const progress = useMemo(() => loadProgress(), [user]);
  const visibleWorlds = useMemo(
    () => getWorldsForUser(context, progress),
    [context, progress],
  );
  const worldStates = useMemo(
    () => getWorldStatesForUser(context, progress),
    [context, progress],
  );

  const summary = useMemo(
    () => summarizeWorlds(visibleWorlds, worldStates, progress),
    [visibleWorlds, worldStates, progress],
  );

  /* The "current" world for the kid is the first one in difficulty order
     that is unlocked but not yet completed. */
  const currentWorld = useMemo(
    () =>
      visibleWorlds.find((w) => worldStates[w.slug] === "current") ??
      visibleWorlds.find((w) => worldStates[w.slug] === "completed") ??
      visibleWorlds[0] ??
      null,
    [visibleWorlds, worldStates],
  );

  const currentActivity = useMemo(
    () => (currentWorld ? currentActivityFor(currentWorld.id, progress) : null),
    [currentWorld, progress],
  );

  /* For the "next locked" world → show it so the kid knows what's coming. */
  const nextLockedWorld = useMemo(
    () => visibleWorlds.find((w) => worldStates[w.slug] === "locked") ?? null,
    [visibleWorlds, worldStates],
  );

  const overallPercent = summary.possibleStars
    ? Math.round((summary.totalStars / summary.possibleStars) * 100)
    : 0;

  const currentWorldStarInfo = currentWorld
    ? worldStarProgress(currentWorld.id, progress)
    : null;
  const currentWorldPercent = currentWorldStarInfo
    ? Math.round((currentWorldStarInfo.earnedStars / currentWorldStarInfo.totalStars) * 100)
    : 0;
  const starsToUnlockNext = currentWorldStarInfo
    ? Math.max(0, currentWorldStarInfo.requiredStars - currentWorldStarInfo.earnedStars)
    : 0;

  /* Friendly label for the current activity so the kid knows what they're
     about to play. */
  const missionHeadline = currentActivity
    ? isLevelCompleted(progress, currentActivity.worldId, currentActivity.levelNumber)
      ? `¡${currentActivity.title} listo!`
      : `Seguí con: ${currentActivity.title}`
    : "¡Mirá tu próxima misión!";

  const missionDescription = currentActivity?.subtitle ?? "Tocá Jugar para seguir aprendiendo.";

  function continueNow() {
    if (!currentWorld) return;
    if (currentActivity) {
      navigate(`/gameplay/${currentActivity.id}`);
    } else {
      navigate(currentWorld.route);
    }
  }

  return (
    <main
      className="missions-page student-soft-page page-fade"
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      <header className="student-page-header">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a mundos
        </Button>
        <div>
          <span>TYPELY</span>
          <h1>Misiones</h1>
          <p>Tu aventura, un nivel a la vez.</p>
        </div>
      </header>

      <section className="missions-hero reward-hero" aria-label="Resumen de tu aventura">
        <div className="missions-hero__icon" aria-hidden="true">
          <Trophy size={36} />
        </div>
        <div className="missions-hero__body">
          <span className="missions-hero__eyebrow">Tu aventura</span>
          <h2>
            {summary.completedWorlds}/{summary.totalWorlds} mundos
            <span className="missions-hero__stars">
              <Star size={20} fill="currentColor" />
              {summary.totalStars}
            </span>
          </h2>
          <p>
            Sumaste {summary.totalStars} estrellas de {summary.possibleStars} posibles · {overallPercent}% del viaje.
          </p>
          <div
            className="missions-hero__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallPercent}
          >
            <span style={{ width: `${overallPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="missions-featured" aria-label="Misión del día">
        <div className="missions-featured__halo" aria-hidden="true" />
        <div className="missions-featured__inner">
          <span className="missions-featured__chip">
            <Sparkles size={16} />
            Misión del día
          </span>
          <h2>{missionHeadline}</h2>
          <p>{missionDescription}</p>

          {currentWorld && (
            <div className="missions-featured__meta">
              <span className="missions-featured__pill">
                <MapPin size={16} />
                {currentWorld.title}
              </span>
              {currentActivity && (
                <span className="missions-featured__pill missions-featured__pill--soft">
                  <Target size={16} />
                  Nivel {currentActivity.levelNumber}
                </span>
              )}
              {currentWorldStarInfo && (
                <span className="missions-featured__pill missions-featured__pill--soft">
                  <Star size={16} fill="currentColor" />
                  {currentWorldStarInfo.earnedStars}/{currentWorldStarInfo.totalStars} ★
                </span>
              )}
            </div>
          )}

          {currentWorld && currentWorldStarInfo && currentWorldStarInfo.earnedStars < currentWorldStarInfo.totalStars && (
            <div
              className="missions-featured__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={currentWorldPercent}
              aria-label={`Progreso en ${currentWorld.title}`}
            >
              <span style={{ width: `${currentWorldPercent}%` }} />
            </div>
          )}

          <div className="missions-featured__cta">
            <Button onClick={continueNow} disabled={!currentWorld || !currentActivity}>
              {currentActivity && isLevelCompleted(progress, currentActivity.worldId, currentActivity.levelNumber)
                ? "Volver a jugar"
                : "Jugar ahora"}
              <ArrowRight size={20} />
            </Button>
            {currentWorld && (
              <Button variant="secondary" onClick={() => navigate(currentWorld.route)}>
                Ver la isla
                <Compass size={18} />
              </Button>
            )}
          </div>

          {currentWorldStarInfo && starsToUnlockNext > 0 && nextLockedWorld && (
            <p className="missions-featured__hint">
              Te faltan <strong>{starsToUnlockNext}★</strong> para desbloquear{" "}
              <strong>{nextLockedWorld.title}</strong>.
            </p>
          )}
        </div>
      </section>

      <section className="missions-grid" aria-label="Mundos en curso">
        {visibleWorlds.map((world) => {
          const state = worldStates[world.slug] as WorldLockState | undefined;
          const stars = worldStarProgress(world.id, progress);
          const worldPercent = stars.totalStars
            ? Math.round((stars.earnedStars / stars.totalStars) * 100)
            : 0;
          const isCurrent = state === "current";
          const isDone = state === "completed";
          const isLocked = state === "locked";
          return (
            <article
              key={world.id}
              className={[
                "missions-card",
                isCurrent ? "is-current" : "",
                isDone ? "is-done" : "",
                isLocked ? "is-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <header className="missions-card__head">
                <span className="missions-card__num">M{world.displayNumber}</span>
                <h3>{world.title}</h3>
              </header>
              <p className="missions-card__topic">{world.topic}</p>
              <div
                className="missions-card__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={worldPercent}
                aria-label={`Estrellas en ${world.title}`}
              >
                <span style={{ width: `${worldPercent}%` }} />
              </div>
              <footer className="missions-card__foot">
                <span className="missions-card__stars">
                  <Star size={14} fill="currentColor" />
                  {stars.earnedStars}/{stars.totalStars}
                </span>
                <span className="missions-card__status">
                  {isDone && (
                    <>
                      <CheckCircle2 size={16} />
                      Completado
                    </>
                  )}
                  {isCurrent && (
                    <>
                      <Flag size={16} />
                      En curso
                    </>
                  )}
                  {isLocked && <>Bloqueado</>}
                </span>
              </footer>
            </article>
          );
        })}
      </section>

      <p className="missions-footnote">
        Cada mundo te pide juntar el 70% de las estrellas para abrir el siguiente. ¡Vamos!
      </p>

      <div className="floating-stars" aria-hidden="true">
        <Star size={22} fill="currentColor" />
        <Star size={16} fill="currentColor" />
        <Star size={18} fill="currentColor" />
      </div>
    </main>
  );
}
