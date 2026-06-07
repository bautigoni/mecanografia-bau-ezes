import { NavLink, useNavigate } from "react-router-dom";
import { Brand } from "../common/Brand";
import { Button } from "../common/Button";
import { useAuth } from "../../hooks/useAuth";

const navLinkClass =
  "glass rounded-xl px-3 py-1.5 font-bold text-sm text-text transition-all hover:bg-white/80 hover:-translate-y-0.5";

export function TopNav({ onMessage }: { onMessage: (message: string) => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 mx-auto my-3 h-14 max-w-[76rem]">
      <Brand compact />
      <nav className="flex items-center gap-2" aria-label="Navegacion principal">
        <NavLink to="/mundos" className={navLinkClass}>
          Misiones
        </NavLink>
        <button
          type="button"
          className={navLinkClass}
          onClick={() => navigate("/logros")}
        >
          Logros
        </button>
        <button
          type="button"
          className={navLinkClass}
          onClick={() => navigate("/mi-cuenta")}
        >
          Mi cuenta
        </button>
      </nav>
      <div className="flex items-center justify-end gap-3">
        <span className="font-bold text-sm text-text">{user?.name ?? "Sofia"}</span>
        <span className="glass rounded-xl px-3 py-1.5 font-bold text-sm text-accent-strong">
          1280 estrellas
        </span>
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
