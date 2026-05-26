import { Flag, LogOut, Medal, Menu, Star, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { worlds, type World } from "../data/worlds";
import { assets } from "../utils/assets";

export function WorldsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);

  function leave() {
    logout();
    navigate("/login");
  }

  function openWorld(world: World) {
    setSelectedWorld(world.id);
    window.setTimeout(() => navigate(world.route), 430);
  }

  return (
    <main
      className={selectedWorld ? "worlds-page page-fade is-entering-world" : "worlds-page page-fade"}
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      <div className="worlds-atmosphere" aria-hidden="true" />

      <div className={menuOpen ? "world-menu is-open" : "world-menu"}>
        <button
          type="button"
          className="world-menu__trigger"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={25} /> : <Menu size={27} />}
        </button>

        {menuOpen && (
          <div className="world-menu__panel" aria-label="Menú de estudiante">
            <button type="button" onClick={() => navigate("/mundos")}>
              <Flag size={19} />
              <span>Misiones</span>
            </button>
            <button type="button" onClick={() => navigate("/logros")}>
              <Medal size={19} />
              <span>Logros</span>
            </button>
            <button type="button" onClick={() => navigate("/mi-cuenta")}>
              <UserRound size={19} />
              <span>Mi cuenta</span>
            </button>
            <button type="button" onClick={() => navigate("/logros")}>
              <Star size={19} />
              <span>1280 estrellas</span>
            </button>
            <button type="button" onClick={leave}>
              <LogOut size={19} />
              <span>Salir</span>
            </button>
          </div>
        )}
      </div>

      <section className="worlds-scene" aria-label="Selección de mundos">
        {worlds.map((world, index) => (
          <button
            key={world.id}
            type="button"
            className={`world-island world-island--${index + 1} ${selectedWorld === world.id ? "is-selected" : ""}`}
            onClick={() => openWorld(world)}
            aria-label={`Abrir ${world.title}`}
          >
            <img src={world.thumbnail} alt={world.title} />
          </button>
        ))}
      </section>

      <div className={selectedWorld ? "world-transition is-active" : "world-transition"} />
      <img className="home-mascot home-mascot--left" src={assets.mascotFemaleLaptop} alt="Mascota con laptop" />
      <img className="home-mascot home-mascot--right" src={assets.mascotMaleProud} alt="Mascota saludando" />
    </main>
  );
}
