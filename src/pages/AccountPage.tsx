import { ArrowLeft, LogOut, Medal, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";

export function AccountPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main className="student-soft-page page-fade" style={{ backgroundImage: `url("${assets.homeBg}")` }}>
      <header className="student-page-header">
        <Button variant="secondary" onClick={() => navigate("/mundos")}>
          <ArrowLeft size={20} />
          Volver a misiones
        </Button>
        <div>
          <span>EduTic</span>
          <h1>Mi cuenta</h1>
          <p>Tu lugar para ver tu aventura y tus insignias.</p>
        </div>
      </header>

      <section className="account-card">
        <div className="account-avatar">
          <Sparkles size={42} />
        </div>
        <h2>{user?.name ?? "Sofía"}</h2>
        <p>3ro A - Turno mañana</p>

        <div className="account-summary">
          <span>Mundo actual</span>
          <strong>Isla de teclas</strong>
          <span>Misión actual</span>
          <strong>Letra rápida</strong>
        </div>

        <div className="account-badges">
          <span>
            <Medal size={22} />
            Medalla inicial
          </span>
          <span>
            <Sparkles size={22} />
            1280 estrellas
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
