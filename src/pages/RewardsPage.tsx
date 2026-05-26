import { ArrowLeft, Backpack, KeyRound, Medal, Shield, Star, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { assets } from "../utils/assets";

const rewards = [
  { name: "Medalla inicial", description: "Completaste tu primera misión.", icon: Medal, unlocked: true },
  { name: "Llave de teclas", description: "Desbloquea caminos nuevos.", icon: KeyRound, unlocked: true },
  { name: "Escudo preciso", description: "Por escribir con cuidado.", icon: Shield, unlocked: false },
  { name: "Mochila digital", description: "Herramientas para aprender.", icon: Backpack, unlocked: false },
];

export function RewardsPage() {
  const navigate = useNavigate();

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
          <h2>1280 estrellas</h2>
          <p>Seguís avanzando por las islas con mucha curiosidad.</p>
        </div>
      </section>

      <section className="reward-grid">
        {rewards.map((reward) => {
          const Icon = reward.icon;
          return (
            <article className={reward.unlocked ? "reward-card is-unlocked" : "reward-card"} key={reward.name}>
              <div>
                <Icon size={34} />
              </div>
              <h3>{reward.name}</h3>
              <p>{reward.description}</p>
              <span>{reward.unlocked ? "Desbloqueado" : "Por desbloquear"}</span>
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
