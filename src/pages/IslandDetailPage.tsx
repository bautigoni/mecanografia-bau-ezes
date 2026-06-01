import { ArrowLeft, ArrowRight, Check, Gem, Lock, Star, Trophy, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { getWorldBySlug, getWorlds, worldStarProgress, type LevelPosition } from "../data/worlds";
import { assets } from "../utils/assets";


function getShipAsset(from: LevelPosition, to?: LevelPosition) {
  if (!to) {
    return assets.shipFront;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) < 4 && dy < 0) {
    return assets.shipBack;
  }

  if (Math.abs(dx) < 4 && dy >= 0) {
    return assets.shipFront;
  }

  if (dx > 0 && Math.abs(dy) < 7) {
    return assets.shipRight;
  }

  if (dx < 0 && Math.abs(dy) < 7) {
    return assets.shipLeft;
  }

  return dx >= 0 ? assets.shipDiagonalRight : assets.shipDiagonalLeft;
}

export function IslandDetailPage() {
  const { islandId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const maybeWorld = useMemo(() => getWorldBySlug(islandId), [islandId, location.key]);
  const allWorlds = useMemo(() => getWorlds(), [location.key]);
  const initialIndex = useMemo(() => {
    if (!maybeWorld) return 0;
    const currentIdx = maybeWorld.levels.findIndex((level) => level.state === "Actual");
    if (currentIdx >= 0) return currentIdx;
    const lastCompleted = [...maybeWorld.levels].reverse().findIndex((l) => l.state === "Completado");
    if (lastCompleted >= 0) return maybeWorld.levels.length - 1 - lastCompleted;
    return 0;
  }, [maybeWorld]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  /* Gate the entrance animation on the actual background image being
     decoded. Until it's ready we still render the whole page (so React
     can lay out level nodes etc.) but we keep the bg + animations hidden
     under a soft sky-coloured layer. Once the image fires onLoad we flip
     the flag and CSS transitions everything to its final state in one
     smooth fade — no more top-to-bottom paint of the JPEG/WebP. */
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!maybeWorld) return;
    setBgReady(false);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setBgReady(true);
    img.onerror = () => setBgReady(true);
    img.src = maybeWorld.background;
    // If the browser had it cached we may already be complete by now.
    if (img.complete && img.naturalWidth > 0) setBgReady(true);
  }, [maybeWorld]);

  if (!maybeWorld) {
    return <Navigate to="/mundos" replace />;
  }

  const world = maybeWorld;
  const actualIndex = world.levels.findIndex((level) => level.state === "Actual");
  const currentIndex = actualIndex >= 0 ? actualIndex : initialIndex;
  const worldNumber = allWorlds.findIndex((item) => item.slug === world.slug) + 1;
  const safeIndex = Math.min(selectedIndex, world.levels.length - 1);
  const selectedLevel = world.levels[safeIndex];
  const currentPosition = world.levelPositions[currentIndex] ?? world.levelPositions[0];
  const nextPosition = world.levelPositions[currentIndex + 1];
  const shipAsset = getShipAsset(currentPosition, nextPosition);
  /* Star progress toward unlocking the next world (70% gate). */
  const starProgress = worldStarProgress(world.slug);
  const isLastWorld = worldNumber >= allWorlds.length;

  function selectLevel(index: number) {
    const level = world.levels[index];
    setSelectedIndex(index);

    if (level.state === "Bloqueado") {
      setMessage("Completá el nivel anterior para desbloquearlo.");
    }
  }

  /* Enters a level by index. Locked levels are blocked unless `bypassLock`
     is set (used by the hidden rapid-click dev shortcut). */
  function enterLevel(index: number, bypassLock = false) {
    const level = world.levels[index];
    if (!level) return;
    if (level.state === "Bloqueado" && !bypassLock) {
      setMessage("Completá el nivel anterior para desbloquearlo.");
      return;
    }
    navigate(`/gameplay/${level.activityId}`);
  }

  /* Rapid-click tracker for the hidden dev shortcut: 5 quick clicks on the
     same level node enter it directly, even when locked. */
  const rapidClick = useRef<{ index: number; count: number; last: number }>({ index: -1, count: 0, last: 0 });
  const RAPID_WINDOW_MS = 450;
  const RAPID_CLICK_COUNT = 5;

  function handleNodeClick(index: number) {
    const now = Date.now();
    const tracker = rapidClick.current;
    if (tracker.index === index && now - tracker.last <= RAPID_WINDOW_MS) {
      tracker.count += 1;
    } else {
      tracker.count = 1;
    }
    tracker.index = index;
    tracker.last = now;

    if (tracker.count >= RAPID_CLICK_COUNT) {
      tracker.count = 0;
      tracker.index = -1;
      enterLevel(index, true); // dev/test shortcut — bypasses the lock
      return;
    }

    selectLevel(index);
  }

  /* Double-click is a normal shortcut into the level (respects the lock). */
  function handleNodeDoubleClick(index: number) {
    setSelectedIndex(index);
    enterLevel(index, false);
  }

  function openLevel() {
    enterLevel(safeIndex, false);
  }

  return (
    <main
      className={`island-detail scene-contain page-fade ${bgReady ? "is-bg-ready" : "is-bg-loading"}`}
      style={{ "--scene-bg": `url("${world.background}")` } as CSSProperties}
    >
      {/* Aspect-ratio-locked stage: the image and every level node share the
          same 16:9 coordinate system, so % positions land on the real
          painted platforms on every screen size. */}
      <div className="island-stage" aria-hidden="false">
        <div className="island-stage__frame">
          <img
            className="island-stage__bg scene-full-image"
            src={world.background}
            alt={world.title}
            decoding="async"
            // @ts-expect-error — fetchPriority is supported by all modern browsers
            fetchpriority="high"
          />

          <section className="level-map" aria-label="Niveles del mundo">
            <img
              className="level-ship"
              src={shipAsset}
              alt="Nave de los estudiantes en el nivel actual"
              decoding="async"
              loading="lazy"
              style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y - 13}%` }}
            />

            {world.levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const position = world.levelPositions[index];
              const isCompleted = level.state === "Completado";
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const isCurrent = level.state === "Actual";
              const isLocked = level.state === "Bloqueado";

              return (
                <button
                  key={level.title}
                  type="button"
                  className={`level-node level-node--${level.state.toLowerCase()} ${isSelected ? "is-selected" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onClick={() => handleNodeClick(index)}
                  onDoubleClick={() => handleNodeDoubleClick(index)}
                  aria-label={`${level.title}: ${level.name}. ${level.state}`}
                >
                  <span className="level-node__platform">
                    {isCompleted && <Check className="level-node__check" size={28} strokeWidth={3.4} />}
                    {isLocked && <Lock className="level-node__lock" size={24} />}
                    <strong className="level-node__number">{level.levelNumber}</strong>
                  </span>
                  <span className="level-node__rating" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, ratingIndex) => (
                      <Star key={ratingIndex} size={16} fill={ratingIndex < level.stars ? "currentColor" : "none"} />
                    ))}
                  </span>
                </button>
              );
            })}
          </section>
        </div>
      </div>

      <button type="button" className="world-back-button" onClick={() => navigate("/mundos")}>
        <ArrowLeft size={23} />
        <span>Volver a mundos</span>
      </button>

      <div className="island-title-panel">
        <span className="world-badge">
          <Star size={18} fill="currentColor" />
          Mundo {worldNumber}
        </span>
        <h1>{world.title}</h1>
        <p>Elegí un nivel para continuar tu aventura.</p>
        <p className="world-star-progress">
          <Star size={15} fill="currentColor" />
          {isLastWorld
            ? `Progreso: ${starProgress.earnedStars} / ${starProgress.totalStars} estrellas`
            : starProgress.isUnlockedNext
              ? `Siguiente mundo desbloqueado · ${starProgress.earnedStars} / ${starProgress.totalStars} estrellas`
              : `Necesitás ${starProgress.requiredStars} de ${starProgress.totalStars} estrellas para desbloquear el siguiente mundo (tenés ${starProgress.earnedStars}).`}
        </p>
      </div>

      <aside className="level-detail-panel" aria-label="Detalle del nivel seleccionado">
        <div className="level-detail-panel__icon">
          {selectedLevel.state === "Bloqueado" ? <Lock size={32} /> : <Star size={36} fill="currentColor" />}
        </div>
        <div>
          <h2>{selectedLevel.title}</h2>
          <h3>{selectedLevel.name}</h3>
          <span className={`status-pill status-pill--${selectedLevel.state.toLowerCase()}`}>{selectedLevel.state}</span>
        </div>

        <Button className="level-detail-panel__cta" onClick={openLevel}>
          <span>Entrar al nivel</span>
          <ArrowRight size={20} strokeWidth={2.8} />
        </Button>

        <p>{selectedLevel.description}</p>

        <div className="reward-row" aria-label="Recompensas">
          <span>
            <Star size={22} fill="currentColor" />
            3
          </span>
          <span>
            <Gem size={22} fill="currentColor" />
            15
          </span>
          <span>
            <Trophy size={22} />
            reto
          </span>
        </div>
      </aside>

      <button type="button" className="profile-bubble" aria-label="Perfil" onClick={() => setMessage("Perfil de Sofía")}>
        <UserRound size={25} />
        <span>Perfil</span>
      </button>

      <Toast message={message} />
    </main>
  );
}
