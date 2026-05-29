import { BookOpen, Check, Flag, FlaskConical, Flower2, Gem, Lock, LogOut, MousePointerClick, Medal, Menu, Star, UserRound, X, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getWorldStates, worlds, type World } from "../data/worlds";
import { Toast } from "../components/common/Toast";
import { assets } from "../utils/assets";

/* Cache of `Image` objects we've already kicked off so a quick hover →
   click sequence reuses the in-flight request rather than firing it twice. */
const prefetched = new Set<string>();
function prefetchImage(src: string) {
  if (!src || prefetched.has(src)) return;
  prefetched.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/* One continuous, flowing magical trail that follows the learning PROGRESSION
   as a clean down → up → down → up staircase, never crossing itself:
     World 1 island1 (16,34) ↓ World 2 island5 (32,67) ↑ World 3 island2
     (50,31) ↓ World 4 island3 (68,67) ↑ World 5 island4 (84,34).
   Coordinates are % of the worlds-scene (viewBox 0-100,
   preserveAspectRatio="none") and track the slug-based island placement in
   global.css. */
const ROUTE_D =
  "M 16 34 C 18.7 39.5, 26.3 67.5, 32 67 " +
  "C 37.7 66.5, 44 31, 50 31 " +
  "C 56 31, 62.3 66.5, 68 67 " +
  "C 73.7 67.5, 81.3 39.5, 84 34";

/* Sparkles rest on the visible open-sky stretches between consecutive
   islands, reinforcing each step of the staircase. */
const routeSparkles = [
  { x: 24, y: 51, delay: 0 },
  { x: 41, y: 49, delay: 1.0 },
  { x: 59, y: 49, delay: 2.0 },
  { x: 76, y: 51, delay: 0.6 },
];

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
  const [message, setMessage] = useState("");
  const pendingNav = useRef<number | null>(null);
  /* Live unlock/lock state per world, derived from saved progress. */
  const worldStates = getWorldStates();

  function leave() {
    logout();
    navigate("/login");
  }

  function openWorld(world: World) {
    /* Locked worlds are not enterable yet — nudge the student instead. */
    if (worldStates[world.slug] === "locked") {
      setMessage("Completá el mundo anterior para desbloquear este.");
      return;
    }
    setSelectedWorld(world.id);
    /* Begin downloading the island background immediately. Once the image is
       in cache, navigating to /worlds/:id is essentially instant — the
       <img> inside IslandDetailPage resolves from the disk/memory cache. */
    const bg = new Image();
    bg.decoding = "async";
    bg.src = world.background;
    prefetched.add(world.background);

    /* Race: keep the existing zoom-out transition, but if the image isn't
       loaded by the end of it, wait up to 700 ms more so the destination
       screen doesn't paint a blank background. */
    const minDelay = 430;
    const maxDelay = 1100;
    const startedAt = performance.now();
    function go() {
      if (pendingNav.current != null) {
        window.clearTimeout(pendingNav.current);
        pendingNav.current = null;
      }
      navigate(world.route);
    }
    if (bg.complete && bg.naturalWidth > 0) {
      pendingNav.current = window.setTimeout(go, minDelay);
    } else {
      bg.onload = () => {
        const elapsed = performance.now() - startedAt;
        pendingNav.current = window.setTimeout(go, Math.max(0, minDelay - elapsed));
      };
      // Absolute upper bound — even on flaky networks, never block forever.
      pendingNav.current = window.setTimeout(go, maxDelay);
    }
  }

  /* Begin downloading an island's full-resolution background as soon as the
     student hovers or focuses its tile on the world map. The actual click
     usually comes 200-800 ms later, by which time the file is already cached. */
  function prefetchWorld(world: World) {
    prefetchImage(world.background);
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
        {/* A single flowing trail threads every island in progression order
            (1 → 4 → 2 → 5 → 3). It tucks behind each island (lower z-index)
            so it reads as a magical route emerging in the open sky between
            them. ROUTE_D is shared by every stroke layer so glow, base,
            dotted trail and travelling shimmer stay perfectly aligned. */}
        <svg className="world-map-path" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <linearGradient id="world-route-gradient" x1="12%" y1="35%" x2="88%" y2="40%">
              <stop offset="0%" stopColor="#fff8ff" stopOpacity="0.28" />
              <stop offset="32%" stopColor="#c9b8ff" stopOpacity="0.78" />
              <stop offset="64%" stopColor="#bff3ff" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#ffd9f1" stopOpacity="0.34" />
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
          <path className="world-map-path__halo" d={ROUTE_D} />
          <path className="world-map-path__base" d={ROUTE_D} />
          <path className="world-map-path__dots" d={ROUTE_D} />
          <path className="world-map-path__shimmer" d={ROUTE_D} />
        </svg>

        {/* Tiny sparkles dotted along the visible stretches of the trail,
            sitting in the open sky between islands. */}
        {routeSparkles.map((spark, index) => (
          <span
            key={index}
            className="world-route-spark"
            style={{ left: `${spark.x}%`, top: `${spark.y}%`, animationDelay: `${spark.delay}s` }}
            aria-hidden="true"
          />
        ))}

        {worlds.map((world) => {
          const BadgeIcon = worldBadges[world.slug];
          const state = worldStates[world.slug];
          const isLocked = state === "locked";
          const isCompleted = state === "completed";

          return (
            <button
              key={world.id}
              type="button"
              className={`world-island world-island--${world.slug} world-island--${state} ${state === "current" ? "is-current" : ""} ${selectedWorld === world.id ? "is-selected" : ""}`}
              onClick={() => openWorld(world)}
              onPointerEnter={() => !isLocked && prefetchWorld(world)}
              onFocus={() => !isLocked && prefetchWorld(world)}
              aria-label={`${worldLabels[world.slug]}${isLocked ? " (bloqueado)" : ""}`}
              aria-disabled={isLocked}
            >
              <span className="world-icon-badge" aria-hidden="true">
                {isLocked ? <Lock size={24} strokeWidth={2.3} /> : <BadgeIcon size={28} strokeWidth={2.1} />}
              </span>
              {isCompleted && (
                <span className="world-complete-badge" aria-hidden="true">
                  <Check size={18} strokeWidth={3.4} />
                </span>
              )}
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

      <Toast message={message} />
    </main>
  );
}
