import { BookOpen, Flag, FlaskConical, Flower2, Gem, LogOut, MousePointerClick, Medal, Menu, Star, UserRound, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { worlds, type World } from "../data/worlds";
import { assets } from "../utils/assets";

const worldBadges = {
  island1: Gem,
  island2: FlaskConical,
  island3: Flower2,
  island4: BookOpen,
  island5: MousePointerClick,
} satisfies Record<World["slug"], LucideIcon>;

const worldLabels = {
  island1: "Mundo código",
  island2: "Mundo ciencia",
  island3: "Mundo creatividad",
  island4: "Mundo biblioteca",
  island5: "Mundo digital",
} satisfies Record<World["slug"], string>;

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
        <svg className="world-map-path" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <linearGradient id="world-route-gradient" x1="18%" y1="44%" x2="88%" y2="52%">
              <stop offset="0%" stopColor="#fff8ff" stopOpacity="0.22" />
              <stop offset="36%" stopColor="#e8ddff" stopOpacity="0.72" />
              <stop offset="68%" stopColor="#d8fbff" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#fff5fb" stopOpacity="0.3" />
            </linearGradient>
            <filter id="world-route-glow" x="-18%" y="-32%" width="136%" height="164%">
              <feGaussianBlur stdDeviation="1.25" result="blur" />
              <feColorMatrix
                in="blur"
                result="tint"
                type="matrix"
                values="0.72 0 0 0 0.28 0 0.5 0 0 0.22 0 0 0.95 0 0.5 0 0 0 0.88 0"
              />
              <feMerge>
                <feMergeNode in="tint" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path className="world-map-path__halo" d="M 14 26 C 24 30, 32 22, 50 18 C 64 16, 76 24, 86 26 M 28 60 C 38 55, 50 50, 62 55 C 70 58, 76 60, 82 62" />
          <path className="world-map-path__base" d="M 14 26 C 24 30, 32 22, 50 18 C 64 16, 76 24, 86 26 M 28 60 C 38 55, 50 50, 62 55 C 70 58, 76 60, 82 62" />
          <path className="world-map-path__dots" d="M 14 26 C 24 30, 32 22, 50 18 C 64 16, 76 24, 86 26 M 28 60 C 38 55, 50 50, 62 55 C 70 58, 76 60, 82 62" />
          <path className="world-map-path__shimmer" d="M 14 26 C 24 30, 32 22, 50 18 C 64 16, 76 24, 86 26 M 28 60 C 38 55, 50 50, 62 55 C 70 58, 76 60, 82 62" />
        </svg>

        {worlds.map((world) => {
          const BadgeIcon = worldBadges[world.slug];
          const isCurrentWorld = world.slug === "island1";

          return (
            <button
              key={world.id}
              type="button"
              className={`world-island world-island--${world.slug} ${isCurrentWorld ? "is-current" : ""} ${selectedWorld === world.id ? "is-selected" : ""}`}
              onClick={() => openWorld(world)}
              aria-label={worldLabels[world.slug]}
            >
              <span className="world-icon-badge" aria-hidden="true">
                <BadgeIcon size={28} strokeWidth={2.1} />
              </span>
              <img src={world.thumbnail} alt="" loading="eager" decoding="async" />
            </button>
          );
        })}
      </section>

      <div className={selectedWorld ? "world-transition is-active" : "world-transition"} />
      <img
        className="home-mascot home-mascot--left"
        src={assets.mascotFemaleLaptop}
        alt=""
        decoding="async"
        loading="lazy"
      />
      <div className="home-mascot-wrap home-mascot-wrap--right">
        <span className="home-speech-bubble">¡Vamos!</span>
        <img
          className="home-mascot home-mascot--right"
          src={assets.mascotMaleProud}
          alt=""
          decoding="async"
          loading="lazy"
        />
      </div>
    </main>
  );
}
