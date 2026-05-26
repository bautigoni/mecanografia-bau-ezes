import { NavLink, useNavigate } from "react-router-dom";
import { Brand } from "../common/Brand";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";

export function TopNav({ onMessage }: { onMessage: (message: string) => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="top-nav">
      <Brand compact />
      <nav className="top-nav__links" aria-label="Navegacion principal">
        <NavLink to="/mundos">Misiones</NavLink>
        <button type="button" onClick={() => navigate("/logros")}>
          Logros
        </button>
        <button type="button" onClick={() => navigate("/mi-cuenta")}>
          Mi cuenta
        </button>
      </nav>
      <div className="top-nav__user">
        <span>{user?.name ?? "Sofia"}</span>
        <span className="points">1280 estrellas</span>
        <Button
          variant="ghost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
