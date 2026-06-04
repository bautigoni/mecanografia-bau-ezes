import {
  AppWindow,
  Asterisk,
  AtSign,
  BookOpen,
  Check,
  Command,
  Flag,
  FlaskConical,
  Flower2,
  Gem,
  GraduationCap,
  Lock,
  LogOut,
  MessageSquare,
  MousePointerClick,
  Medal,
  Menu,
  PenLine,
  Search,
  Star,
  Trophy,
  Type,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getWorldStatesForUser, getWorldsForUser, worldStarProgress, type World } from "../data/worlds";
import { Toast } from "../components/common/Toast";
import { assets } from "../utils/assets";
import { getUserContext, makeRapidClickDetector } from "../utils/userContext";
import { loadProgress } from "../utils/progress";

/* ------------------------------------------------------------------ */
/* Asset pre-fetch cache                                               */
/* ------------------------------------------------------------------ */
const prefetched = new Set<string>();
function prefetchImage(src: string) {
  if (!src || prefetched.has(src)) return;
  prefetched.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/* ------------------------------------------------------------------ */
/* World-map layout helpers                                            */
/* ------------------------------------------------------------------ */
const TRACK_PADDING_VW = 26;

function trackWidth(worlds: World[]) {
  if (!worlds.length) return 100;
  return Math.max(...worlds.map((w) => w.map.x)) + TRACK_PADDING_VW;
}

/** Visual centre of an island (for the SVG trail path). */
function islandCenter(world: World) {
  return { x: world.map.x + 10, y: world.map.y + 16 };
}

function buildRoute(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Badge + label dictionaries                                          */
/* ------------------------------------------------------------------ */
const worldBadges: Record<World["slug"], LucideIcon> = {
  island1: Gem,
  island2: FlaskConical,
  island3: Flower2,
  island4: BookOpen,
  island5: MousePointerClick,
  island6: Type,
  island7: PenLine,
  island8: Asterisk,
  island9: AtSign,
  island10: Search,
  island11: Command,
  island12: AppWindow,
  island13: MessageSquare,
  island14: Zap,
  island15: Trophy,
};

const worldLabels: Record<World["slug"], string> = {
  island1: "Mundo letras",
  island2: "Mundo palabras",
  island3: "Mundo biblioteca",
  island4: "Mundo símbolos",
  island5: "Mundo digital",
  island6: "Mundo escritura",
  island7: "Mundo palabras largas",
  island8: "Mundo signos",
  island9: "Mundo correos",
  island10: "Mundo búsquedas",
  island11: "Mundo comandos",
  island12: "Mundo ventanas",
  island13: "Mundo mensajes",
  island14: "Mundo atajos",
  island15: "Mundo gran reto",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export function WorldsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  /* Hold a short "preparando…" screen on the FIRST visit per session so the
     map reveals fully painted instead of popping in island by island. */
  const [worldsReady, setWorldsReady] = useState(() => {
    try {
      return sessionStorage.getItem("edutic.worldsLoaded") === "1";
    } catch {
      return false;
    }
  });
  /* Slugs that became unlocked since the last visit → play a celebratory
     reveal animation when the student returns to the map. */
  const [justUnlocked, setJustUnlocked] = useState<Set<string>>(new Set());
  const pendingNav = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  /* Build the user context once per render so course-filtering is live. */
  const context = getUserContext(user);
  const progress = loadProgress();
  const visibleWorlds = getWorldsForUser(context, progress);
  const worldStates = getWorldStatesForUser(context, progress);

  /* Track widths and SVG path — memoized so the heavy SVG path string is
     rebuilt only when the visible set changes, not on every hover/focus
     render. Cheaper than relying on the referential stability of
     `visibleWorlds` (the function reads localStorage). */
  const trackWidthVw = useMemo(() => trackWidth(visibleWorlds), [visibleWorlds]);
  const centers = useMemo(() => visibleWorlds.map(islandCenter), [visibleWorlds]);
  const ROUTE_D = useMemo(() => buildRoute(centers), [centers]);
  const routeSparkles = useMemo(
    () =>
      centers.slice(0, -1).map((c, i) => ({
        x: (c.x + centers[i + 1].x) / 2,
        y: (c.y + centers[i + 1].y) / 2,
        delay: (i % 4) * 0.6,
      })),
    [centers],
  );

  /* Hidden 5-click dev bypass — clicking an island 5× quickly enters it
     even if it is locked.  No UI feedback is shown; it's invisible to
     normal students. */
  const devClickRef = useRef(makeRapidClickDetector(450, 5));

  /* Auto-scroll so the next unlocked world is centred on load. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const currentWorld =
      visibleWorlds.find((w) => worldStates[w.slug] === "current") ?? visibleWorlds[0];
    if (!currentWorld) return;
    const vwPx = window.innerWidth / 100;
    const targetPx = (currentWorld.map.x + 8) * vwPx;
    const left = Math.max(0, targetPx - scene.clientWidth / 2);
    scene.scrollTo({ left, behavior: "smooth" });
    // Run once on mount; unlock-state changes after page-load are rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Preload every island thumbnail behind the "preparando…" screen, then
     reveal the map. Waits for all images to decode (so nothing pops in), with
     a ~1.8 s minimum so it reads as intentional and a 3.5 s hard cap so it can
     never hang. Only the first visit per session waits — later returns (assets
     already cached) skip the loader entirely. */
  useEffect(() => {
    if (worldsReady) return;
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      try {
        sessionStorage.setItem("edutic.worldsLoaded", "1");
      } catch {
        /* ignore */
      }
      setWorldsReady(true);
    };
    const urls = Array.from(new Set(visibleWorlds.map((w) => w.thumbnail)));
    if (urls.length === 0) {
      finish();
      return;
    }
    const start = performance.now();
    const MIN_MS = 1800;
    let remaining = urls.length;
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) {
        const elapsed = performance.now() - start;
        window.setTimeout(finish, Math.max(0, MIN_MS - elapsed));
      }
    };
    urls.forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = onOne;
      img.onerror = onOne;
      img.src = src;
      prefetched.add(src);
    });
    const cap = window.setTimeout(finish, 3500);
    return () => {
      cancelled = true;
      window.clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Detect islands unlocked since the last visit and flag them for the reveal
     animation. Runs once the map is actually visible (after the loader). On a
     student's very first ever visit we only record the baseline — no burst. */
  useEffect(() => {
    if (!worldsReady) return;
    const KEY = "edutic.unlockedSeen";
    const unlockedSlugs = visibleWorlds
      .filter((w) => worldStates[w.slug] !== "locked")
      .map((w) => w.slug);
    let prev: string[] | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      prev = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      prev = null;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(unlockedSlugs));
    } catch {
      /* ignore */
    }
    if (!prev) return; // first ever visit — just record the baseline
    const prevSet = new Set(prev);
    const newly = unlockedSlugs.filter((s) => !prevSet.has(s));
    if (newly.length === 0) return;
    setJustUnlocked(new Set(newly));
    const t = window.setTimeout(() => setJustUnlocked(new Set()), 2400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldsReady]);

  function leave() {
    logout();
    navigate("/login");
  }

  function enterWorld(world: World, bypassLock = false) {
    if (worldStates[world.slug] === "locked" && !bypassLock) {
      setMessage("Conseguí el 70% de estrellas del mundo anterior para desbloquear este mundo.");
      return;
    }
    /* Pre-fetch the island background so the destination page paints instantly.
       We used to gate the navigation on a JS timer (430–1100 ms) so the radial
       white flash had time to animate. The flash itself is CSS — it keeps
       playing while we navigate — so the JS timer was just blocking the user.
       A simple `setSelectedWorld` flips the `.is-entering-world` class, the
       CSS transition (`.world-transition.is-active`) handles the fade, and
       the next page appears as soon as React commits. Net effect: navigation
       feels snappier, especially on slow devices, with no visual regression. */
    setSelectedWorld(world.id);
    prefetched.add(world.background);
    if (pendingNav.current != null) window.clearTimeout(pendingNav.current);
    /* Tiny delay so the CSS transition starts before the route changes,
       otherwise the new page mounts over the still-fading overlay. 1
       frame is enough. */
    pendingNav.current = window.setTimeout(() => {
      pendingNav.current = null;
      navigate(world.route);
    }, 16);
  }

  function handleIslandClick(world: World) {
    const isLocked = worldStates[world.slug] === "locked";

    /* Hidden dev bypass: 5 quick clicks on the same island open it even when
       locked (for testing / presenting the full product). Everyone else —
       including the admin/superadmin player — must earn 70% of the previous
       world's stars first, so the unlock gate actually blocks during play. */
    const devBypass = devClickRef.current(world.id);
    if (devBypass && isLocked) {
      enterWorld(world, true);
      return;
    }
    enterWorld(world, false);
  }

  function prefetchWorld(world: World) {
    prefetchImage(world.background);
  }

  /* Real running star total for the menu chip (was a hardcoded "1280"). */
  const totalEarnedStars = visibleWorlds.reduce(
    (sum, w) => sum + worldStarProgress(w.id, progress).earnedStars,
    0,
  );

  return (
    <main
      className={
        selectedWorld ? "worlds-page page-fade is-entering-world" : "worlds-page page-fade"
      }
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      <div className="worlds-atmosphere" aria-hidden="true" />

      {!worldsReady && (
        <div className="worlds-loader" role="status" aria-live="polite">
          <div className="worlds-loader__card">
            <span className="worlds-loader__halo" aria-hidden="true" />
            <img
              className="worlds-loader__mascot"
              src={assets.mascotMaleProud}
              alt=""
              decoding="async"
            />
            <span className="worlds-loader__spinner" aria-hidden="true" />
            <p>Preparando tu aventura…</p>
          </div>
        </div>
      )}

      {/* ── Hamburger menu ── */}
      <div className={menuOpen ? "world-menu is-open" : "world-menu"}>
        <button
          type="button"
          className="world-menu__trigger"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
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
              <span>{totalEarnedStars} estrellas</span>
            </button>
            {/* Superadmin-only shortcut to the teacher/admin panel. */}
            {context.isSuperAdmin && (
              <button type="button" onClick={() => navigate("/profesor")}>
                <GraduationCap size={19} />
                <span>Panel docente</span>
              </button>
            )}
            <button type="button" onClick={leave}>
              <LogOut size={19} />
              <span>Salir</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Horizontally scrollable world journey ── */}
      <section
        className="worlds-scene"
        aria-label="Selección de mundos"
        ref={sceneRef}
      >
        <div className="worlds-track" style={{ width: `${trackWidthVw}vw` }}>
          {/* Magical trail SVG */}
          <svg
            className="world-map-path"
            viewBox={`0 0 ${trackWidthVw} 100`}
            aria-hidden="true"
            preserveAspectRatio="none"
            style={{ width: `${trackWidthVw}vw` }}
          >
            <defs>
              <linearGradient id="world-route-gradient" x1="0%" y1="35%" x2="100%" y2="40%">
                <stop offset="0%"   stopColor="#fff8ff" stopOpacity="0.28" />
                <stop offset="32%"  stopColor="#c9b8ff" stopOpacity="0.78" />
                <stop offset="64%"  stopColor="#bff3ff" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#ffd9f1" stopOpacity="0.34" />
              </linearGradient>
              <filter id="world-route-glow" x="-18%" y="-32%" width="136%" height="164%">
                <feGaussianBlur stdDeviation="1.25" result="blur" />
                <feColorMatrix
                  in="blur" result="tint" type="matrix"
                  values="0.72 0 0 0 0.28  0 0.5 0 0 0.22  0 0 0.95 0 0.5  0 0 0 0.88 0"
                />
                <feMerge>
                  <feMergeNode in="tint" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path className="world-map-path__halo"    d={ROUTE_D} />
            <path className="world-map-path__base"    d={ROUTE_D} />
            <path className="world-map-path__dots"    d={ROUTE_D} />
            <path className="world-map-path__shimmer" d={ROUTE_D} />
          </svg>

          {/* Sparkles between islands */}
          {routeSparkles.map((spark, idx) => (
            <span
              key={idx}
              className="world-route-spark"
              style={{ left: `${spark.x}vw`, top: `${spark.y}%`, animationDelay: `${spark.delay}s` }}
              aria-hidden="true"
            />
          ))}

          {/* Island buttons */}
          {visibleWorlds.map((world) => {
            const BadgeIcon = worldBadges[world.slug];
            const state = worldStates[world.slug];
            const isLocked = state === "locked";
            const isCompleted = state === "completed";
            const isCurrent = state === "current";
            const starInfo = worldStarProgress(world.id, progress);
            const ctaLabel = isCompleted
              ? "Volver a jugar"
              : isCurrent
                ? "Seguir jugando"
                : "Jugar";
            const starsClass = isCompleted
              ? "world-stars-chip world-stars-chip--complete"
              : isLocked
                ? "world-stars-chip world-stars-chip--locked"
                : "world-stars-chip";

            return (
              <div
                key={world.id}
                className="world-island-wrap"
                style={{ left: `${world.map.x}vw`, top: `${world.map.y}%` }}
              >
                <button
                  type="button"
                  className={[
                    "world-island",
                    `world-island--${world.slug}`,
                    `world-island--${state}`,
                    isCurrent ? "is-current" : "",
                    justUnlocked.has(world.slug) ? "is-unlocking" : "",
                    selectedWorld === world.id ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleIslandClick(world)}
                  onPointerEnter={() => !isLocked && prefetchWorld(world)}
                  onFocus={() => !isLocked && prefetchWorld(world)}
                  aria-label={`${worldLabels[world.slug]}${
                    isLocked ? " (bloqueado)" : isCompleted ? " (completado)" : ""
                  }`}
                  aria-disabled={isLocked}
                >
                  <span className="world-icon-badge" aria-hidden="true">
                    {isLocked ? (
                      <Lock size={24} strokeWidth={2.3} />
                    ) : (
                      <>
                        <span className="world-icon-badge__num">M{world.displayNumber}</span>
                        <BadgeIcon size={20} strokeWidth={2.1} className="world-icon-badge__icon" />
                      </>
                    )}
                  </span>
                  <span className={starsClass} aria-hidden="true">
                    <Star size={14} strokeWidth={2.4} className="world-stars-chip__icon" />
                    {starInfo.earnedStars}/{starInfo.totalStars}
                  </span>
                  {/* The tick is decorative — the button's aria-label already
                      announces "completado". */}
                  {isCompleted && (
                    <span className="world-complete-badge" aria-hidden="true">
                      <Check size={18} strokeWidth={3.4} />
                    </span>
                  )}
                  <img src={world.thumbnail} alt="" loading="eager" decoding="async" />
                  {/* Locked islands are hidden behind a frosted veil so the
                      real art can't be previewed — a "default" mystery island
                      with a padlock. */}
                  {isLocked && <span className="world-island__frost" aria-hidden="true" />}
                  {/* Celebratory sparkle burst when this island is unlocked. */}
                  {justUnlocked.has(world.slug) && (
                    <span className="world-island__burst" aria-hidden="true">
                      <i /><i /><i /><i /><i /><i />
                    </span>
                  )}
                </button>
                {/* Kept for visual continuity with prior layout — also gives
                    a label that screen-readers can announce. */}
                <span className="sr-only">{ctaLabel}: {worldLabels[world.slug]}</span>
              </div>
            );
          })}
        </div>
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
