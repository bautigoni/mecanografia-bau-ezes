import { ArrowLeft, Check, Gem, Lock, Star, Trophy, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { getWorldBySlug, getWorlds, type LevelPosition } from "../data/worlds";
import { assets } from "../utils/assets";

const MASCOT_BUBBLES = {
  Completado: [
    "¡Genial! Otro nivel dominado.",
    "Sos imparable.",
    "¡Tres estrellas brillantes!",
    "Lo lograste 💪",
  ],
  Actual: [
    "¡Vamos! Este es tu nivel.",
    "Respirá hondo y empezá.",
    "Confío en vos.",
    "Probá una vez más.",
  ],
  Bloqueado: [
    "Primero terminá el nivel anterior.",
    "Falta poquito para desbloquearlo.",
    "Seguí el camino, paso a paso.",
    "Lo vas a alcanzar pronto.",
  ],
} as const;

function pickBubble(state: keyof typeof MASCOT_BUBBLES, levelIndex: number): string {
  const pool = MASCOT_BUBBLES[state];
  return pool[levelIndex % pool.length];
}

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

  if (!maybeWorld) {
    return <Navigate to="/mundos" replace />;
  }

  const world = maybeWorld;
  const currentIndex = Math.max(
    0,
    world.levels.findIndex((level) => level.state === "Actual"),
  );
  const worldNumber = allWorlds.findIndex((item) => item.slug === world.slug) + 1;
  const safeIndex = Math.min(selectedIndex, world.levels.length - 1);
  const selectedLevel = world.levels[safeIndex];
  const currentPosition = world.levelPositions[currentIndex] ?? world.levelPositions[0];
  const nextPosition = world.levelPositions[currentIndex + 1];
  const shipAsset = getShipAsset(currentPosition, nextPosition);

  function selectLevel(index: number) {
    const level = world.levels[index];
    setSelectedIndex(index);

    if (level.state === "Bloqueado") {
      setMessage("Completá el nivel anterior para desbloquearlo.");
    }
  }

  function openLevel() {
    if (selectedLevel.state === "Bloqueado") {
      setMessage("Completá el nivel anterior para desbloquearlo.");
      return;
    }

    navigate(`/gameplay/${selectedLevel.activityId}`);
  }

  return (
    <main
      className="island-detail scene-contain page-fade"
      style={{ "--scene-bg": `url("${world.background}")` } as CSSProperties}
    >
      <img className="scene-full-image" src={world.background} alt={world.title} />
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
      </div>

      <section className="level-map" aria-label="Niveles del mundo">
        <img
          className="level-ship"
          src={shipAsset}
          alt="Nave de los estudiantes en el nivel actual"
          style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y - 13}%` }}
        />

        {world.levels.map((level, index) => {
          const isSelected = index === selectedIndex;
          const position = world.levelPositions[index];
          const isCompleted = level.state === "Completado";
          const isCurrent = level.state === "Actual";
          const isLocked = level.state === "Bloqueado";

          return (
            <button
              key={level.title}
              type="button"
              className={`level-node level-node--${level.state.toLowerCase()} ${isSelected ? "is-selected" : ""}`}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onClick={() => selectLevel(index)}
              aria-label={`${level.title}: ${level.name}. ${level.state}`}
            >
              <span className="level-node__platform">
                {isCompleted && <Check className="level-node__check" size={28} strokeWidth={3.4} />}
                {isLocked && <Lock className="level-node__lock" size={24} />}
                <strong>{index + 1}</strong>
              </span>
              <span className="level-node__rating" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, ratingIndex) => (
                  <Star key={ratingIndex} size={16} fill={isCompleted || isCurrent ? "currentColor" : "none"} />
                ))}
              </span>
            </button>
          );
        })}
      </section>

      <aside className="level-detail-panel" aria-label="Detalle del nivel seleccionado">
        <div className="level-detail-panel__icon">
          {selectedLevel.state === "Bloqueado" ? <Lock size={32} /> : <Star size={36} fill="currentColor" />}
        </div>
        <div>
          <h2>{selectedLevel.title}</h2>
          <h3>{selectedLevel.name}</h3>
          <span className={`status-pill status-pill--${selectedLevel.state.toLowerCase()}`}>{selectedLevel.state}</span>
        </div>

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

        <Button className="level-detail-panel__cta" onClick={openLevel}>
          Entrar al nivel
        </Button>
      </aside>

      <button type="button" className="profile-bubble" aria-label="Perfil" onClick={() => setMessage("Perfil de Sofía")}>
        <UserRound size={25} />
        <span>Perfil</span>
      </button>

      <div className="island-mascots" aria-hidden="true">
        <figure className="island-mascot island-mascot--left">
          <div className={`island-mascot__bubble island-mascot__bubble--${selectedLevel.state.toLowerCase()}`}>
            {pickBubble(selectedLevel.state, safeIndex)}
          </div>
          <img src={assets.mascotFemaleWave} alt="" />
        </figure>
        <figure className="island-mascot island-mascot--right">
          <div className={`island-mascot__bubble island-mascot__bubble--${selectedLevel.state.toLowerCase()}`}>
            {pickBubble(selectedLevel.state, (safeIndex + 1) % 4)}
          </div>
          <img src={assets.mascotMaleProud} alt="" />
        </figure>
      </div>

      <Toast message={message} />
    </main>
  );
}
