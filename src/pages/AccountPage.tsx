import { ArrowLeft, LogOut, Medal, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { StarCounter } from "../components/common/StarCounter";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { getUserContext } from "../utils/userContext";
import { loadProgress } from "../utils/progress";
import { getWorldStatesForUser, getWorldsForUser, worldStarProgress } from "../data/worlds";

export function AccountPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  /* Real progress snapshot — replaces the old hardcoded placeholders so the
     account screen reflects the student's actual adventure. */
  const context = getUserContext(user);
  const progress = loadProgress();
  const visibleWorlds = getWorldsForUser(context, progress);
  const worldStates = getWorldStatesForUser(context, progress);
  const totalStars = visibleWorlds.reduce(
    (sum, w) => sum + worldStarProgress(w.id, progress).earnedStars,
    0,
  );
  const currentWorld =
    visibleWorlds.find((w) => worldStates[w.slug] === "current") ??
    [...visibleWorlds].reverse().find((w) => worldStates[w.slug] === "completed") ??
    visibleWorlds[0];
  const currentLevel =
    currentWorld?.levels.find((l) => l.state === "Actual") ??
    currentWorld?.levels.find((l) => l.state !== "Completado") ??
    currentWorld?.levels[0];

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main className="student-soft-page page-fade" style={{ backgroundImage: `url("${assets.homeBg}")` }}>
      {/* Contador de estrellas de la cuenta (siempre visible, arriba a la derecha). */}
      <StarCounter className="fixed top-4 right-4 z-30" />
      <header className="student-page-header">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a misiones
        </Button>
        <div>
          <span>TYPELY</span>
          <h1>Mi cuenta</h1>
          <p>Tu lugar para ver tu aventura y tus insignias.</p>
        </div>
      </header>

      <section className="account-card">
        <div className="account-avatar">
          <Sparkles size={42} />
        </div>
        <h2>{user?.name ?? "Estudiante"}</h2>
        <p>{user?.email ?? "Estudiante de TYPELY"}</p>

        <div className="account-summary">
          <span>Mundo actual</span>
          <strong>{currentWorld?.title ?? "Aún no empezaste"}</strong>
          <span>Misión actual</span>
          <strong>{currentLevel?.name ?? "Elegí tu primer nivel"}</strong>
        </div>

        <div className="account-badges">
          <span>
            <Medal size={22} />
            {totalStars > 0 ? `${totalStars} estrellas ganadas` : "Sin estrellas todavía"}
          </span>
          <span>
            <Sparkles size={22} />
            {totalStars} estrellas
          </span>
        </div>

        <p className="friendly-message">Cada tecla que encontrás te acerca a una nueva isla. Seguí jugando con calma.</p>

        <div className="account-actions">
          <Button onClick={() => navigate("/mundos")}>Volver a misiones</Button>
          <Button variant="secondary" onClick={() => navigate("/logros")}>
            Ver logros
          </Button>
          <Button variant="ghost" onClick={leave}>
            <LogOut size={19} />
            Cerrar sesión
          </Button>
        </div>
      </section>
    </main>
  );
}
