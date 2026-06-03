import { ArrowLeft, Backpack, KeyRound, Medal, Shield, Star, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { assets } from "../utils/assets";
import { useAuth } from "../hooks/useAuth";
import { getUserContext } from "../utils/userContext";
import { loadProgress } from "../utils/progress";
import { getWorldsForUser, worldStarProgress } from "../data/worlds";

/* Badges unlock at real star milestones so the screen reflects actual play
   instead of a hardcoded unlocked/locked flag. */
const rewards = [
  { name: "Medalla inicial", description: "Completaste tu primera misión.", icon: Medal, threshold: 1 },
  { name: "Llave de teclas", description: "Desbloquea caminos nuevos.", icon: KeyRound, threshold: 10 },
  { name: "Escudo preciso", description: "Por escribir con cuidado.", icon: Shield, threshold: 30 },
  { name: "Mochila digital", description: "Herramientas para aprender.", icon: Backpack, threshold: 60 },
];

export function RewardsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const context = getUserContext(user);
  const progress = loadProgress();
  const totalStars = getWorldsForUser(context, progress).reduce(
    (sum, w) => sum + worldStarProgress(w.id, progress).earnedStars,
    0,
  );

  return (
    <main className="student-soft-page page-fade" style={{ backgroundImage: `url("${assets.homeBg}")` }}>
      <header className="student-page-header">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a mundos
        </Button>
        <div>
          <span>TYPELY</span>
          <h1>Logros</h1>
          <p>Insignias y recompensas de tu aventura digital.</p>
        </div>
      </header>

      <section className="reward-hero">
        <Trophy size={54} />
        <div>
          <h2>{totalStars} estrellas</h2>
          <p>Seguís avanzando por las islas con mucha curiosidad.</p>
        </div>
      </section>

      <section className="reward-grid">
        {rewards.map((reward) => {
          const Icon = reward.icon;
          const unlocked = totalStars >= reward.threshold;
          return (
            <article className={unlocked ? "reward-card is-unlocked" : "reward-card"} key={reward.name}>
              <div>
                <Icon size={34} />
              </div>
              <h3>{reward.name}</h3>
              <p>{reward.description}</p>
              <span>{unlocked ? "Desbloqueado" : `Por desbloquear · ${reward.threshold}★`}</span>
            </article>
          );
        })}
      </section>

      <div className="floating-stars" aria-hidden="true">
        <Star size={22} fill="currentColor" />
        <Star size={16} fill="currentColor" />
        <Star size={18} fill="currentColor" />
      </div>
    </main>
  );
}
