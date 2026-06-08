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
/* Right-edge padding past the last island. Has to cover the island's
   20vw footprint + hover/selected lift + a visual gutter so the last
   island doesn't sit flush against the scroll edge (which would let
   the right half of the island get clipped by the scene's
   overflow:hidden + the body padding). 40vw is enough for the 20vw
   island plus the lift margin and ~5–6vw of visual breathing room on
   every viewport. */
const TRACK_PADDING_VW = 40;

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
/* Per-island theme gradients (replaces BEM `world-island--islandN`)   */
/* ------------------------------------------------------------------ */
const islandTheme: Record<World["slug"], { ring: string; glow: string; badge: string }> = {
  island1:  { ring: "from-sky-300 to-blue-400",       glow: "rgba(51,199,240,0.45)", badge: "from-sky-400 to-blue-500" },
  island2:  { ring: "from-emerald-300 to-teal-400",    glow: "rgba(34,199,184,0.45)", badge: "from-emerald-400 to-teal-500" },
  island3:  { ring: "from-violet-300 to-purple-400",   glow: "rgba(156,113,255,0.45)", badge: "from-violet-400 to-purple-500" },
  island4:  { ring: "from-indigo-300 to-blue-500",     glow: "rgba(83,107,255,0.45)",  badge: "from-indigo-400 to-blue-600" },
  island5:  { ring: "from-cyan-300 to-sky-400",        glow: "rgba(51,199,240,0.45)", badge: "from-cyan-400 to-sky-500" },
  island6:  { ring: "from-teal-300 to-emerald-400",    glow: "rgba(89,203,183,0.45)", badge: "from-teal-400 to-emerald-500" },
  island7:  { ring: "from-lime-300 to-green-400",      glow: "rgba(132,204,22,0.40)", badge: "from-lime-400 to-green-500" },
  island8:  { ring: "from-amber-300 to-orange-400",    glow: "rgba(251,191,36,0.45)", badge: "from-amber-400 to-orange-500" },
  island9:  { ring: "from-rose-300 to-pink-400",       glow: "rgba(255,159,202,0.45)", badge: "from-rose-400 to-pink-500" },
  island10: { ring: "from-fuchsia-300 to-pink-400",    glow: "rgba(217,70,239,0.40)", badge: "from-fuchsia-400 to-pink-500" },
  island11: { ring: "from-blue-300 to-indigo-400",     glow: "rgba(99,102,241,0.45)", badge: "from-blue-400 to-indigo-500" },
  island12: { ring: "from-sky-300 to-cyan-400",        glow: "rgba(56,189,248,0.45)", badge: "from-sky-400 to-cyan-500" },
  island13: { ring: "from-pink-300 to-rose-400",       glow: "rgba(255,127,160,0.45)", badge: "from-pink-400 to-rose-500" },
  island14: { ring: "from-yellow-300 to-amber-400",    glow: "rgba(250,204,21,0.45)", badge: "from-yellow-400 to-amber-500" },
  island15: { ring: "from-violet-400 to-fuchsia-400",  glow: "rgba(168,85,247,0.50)", badge: "from-violet-500 to-fuchsia-500" },
};

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
  /* The island art is now optimized/lightweight, so we no longer hold a
     "preparando…" splash — the map renders immediately on every visit. */
  const [worldsReady] = useState(true);
  /* Slugs that became unlocked since the last visit → play a celebratory
     reveal animation when the student returns to the map. */
  const [justUnlocked, setJustUnlocked] = useState<Set<string>>(new Set());
  const pendingNav = useRef<number | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  /* Build the user context + world model once per user (not on every render).
     Rebuilding all 15 worlds + reading localStorage on each hover/menu toggle
     was a real cost; memoizing removes it. Progress is stable within a mount
     (this page never writes it). */
  const context = useMemo(() => getUserContext(user), [user]);
  const progress = useMemo(() => loadProgress(), [user]);
  const visibleWorlds = useMemo(() => getWorldsForUser(context, progress), [context, progress]);
  const worldStates = useMemo(() => getWorldStatesForUser(context, progress), [context, progress]);

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
  const totalEarnedStars = useMemo(
    () => visibleWorlds.reduce((sum, w) => sum + worldStarProgress(w.id, progress).earnedStars, 0),
    [visibleWorlds, progress],
  );

  return (
    <main
      className={[
        "relative min-h-dvh overflow-hidden bg-cover bg-center animate-page-fade",
        "transition-opacity duration-500",
        selectedWorld ? "opacity-60" : "opacity-100",
      ].join(" ")}
      style={{ backgroundImage: `url("${assets.homeBg}")` }}
    >
      {/* Atmospheric radial-gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(51,199,240,0.14), transparent 60%)," +
            "radial-gradient(ellipse 60% 50% at 20% 70%, rgba(156,113,255,0.10), transparent 55%)," +
            "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(255,159,202,0.10), transparent 55%)",
        }}
        aria-hidden="true"
      />

      {/* ── Hamburger menu ── */}
      <div className="fixed top-4 right-4 z-30 flex flex-col items-end gap-2">
        <button
          type="button"
          className="glass w-11 h-11 grid place-items-center rounded-full border-0 cursor-pointer text-text shadow-md transition-transform hover:scale-105 active:scale-95"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={25} /> : <Menu size={27} />}
        </button>

        {menuOpen && (
          <div
            className="glass-surface grid gap-1 p-3 rounded-2xl animate-menu-reveal min-w-[12rem]"
            aria-label="Menú de estudiante"
          >
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/misiones")}
            >
              <Flag size={19} />
              <span>Misiones</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/logros")}
            >
              <Medal size={19} />
              <span>Logros</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/mi-cuenta")}
            >
              <UserRound size={19} />
              <span>Mi cuenta</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={() => navigate("/logros")}
            >
              <Star size={19} />
              <span>{totalEarnedStars} estrellas</span>
            </button>
            {/* Superadmin-only shortcut to the teacher/admin panel. */}
            {context.isSuperAdmin && (
              <button
                type="button"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
                onClick={() => navigate("/profesor")}
              >
                <GraduationCap size={19} />
                <span>Panel docente</span>
              </button>
            )}
            <button
              type="button"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-text font-semibold text-sm cursor-pointer bg-transparent border-0 hover:bg-white/40 transition-colors text-left w-full"
              onClick={leave}
            >
              <LogOut size={19} />
              <span>Salir</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Horizontally scrollable world journey ── */}
      <section
        className="world-scroll relative w-full h-dvh overflow-x-auto overflow-y-hidden scroll-smooth"
        aria-label="Selección de mundos"
        ref={sceneRef}
      >
        <div
          className="relative h-full"
          style={{ width: `${trackWidthVw}vw` }}
        >
          {/* Magical trail SVG */}
          <svg
            className="absolute top-0 left-0 pointer-events-none h-full"
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
                {/* stdDeviation 1.25 → 0.8: a tighter blur is dramatically
                    cheaper to re-rasterize on every `routeShimmer` tick, and
                    the glow stays visible because the gradient itself is
                    pastel. */}
                <feGaussianBlur stdDeviation="0.8" result="blur" />
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
            {/* Shared route geometry — referenced by the travelling stars'
                <animateMotion> so they ride exactly along the trail. */}
            <path id="world-route-path" d={ROUTE_D} fill="none" stroke="none" />
            {/* Wide soft halo behind the route (thinner, daintier) */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="url(#world-route-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="0"
              opacity="0.3"
              filter="url(#world-route-glow)"
            />
            {/* Solid base line */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="url(#world-route-gradient)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Dotted overlay */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="white"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeDasharray="1.2 4"
              opacity="0.5"
            />
            {/* Shimmer highlight */}
            <path
              d={ROUTE_D}
              fill="none"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeDasharray="6 40"
              opacity="0.7"
              className="animate-route-shimmer"
              style={{ strokeDashoffset: 0 }}
            />
            {/* Stars travelling along the trail — each rides the shared path
                via <animateMotion mpath>, staggered so they stream along. */}
            {[0, 1, 2, 3].map((i) => (
              <circle key={`travel-${i}`} r="0.7" fill="#fff8ff" opacity="0.95">
                <animateMotion dur="6s" repeatCount="indefinite" begin={`${i * 1.5}s`} rotate="auto">
                  <mpath href="#world-route-path" />
                </animateMotion>
                <animate
                  attributeName="r"
                  values="0.35;0.9;0.35"
                  dur="1.2s"
                  repeatCount="indefinite"
                  begin={`${i * 1.5}s`}
                />
              </circle>
            ))}
          </svg>

          {/* Sparkles between islands */}
          {routeSparkles.map((spark, idx) => (
            <span
              key={idx}
              className="absolute w-2.5 h-2.5 rounded-full animate-spark-twinkle pointer-events-none"
              style={{
                left: `${spark.x}vw`,
                top: `${spark.y}%`,
                animationDelay: `${spark.delay}s`,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95), rgba(201,184,255,0.5) 60%, transparent 80%)",
                boxShadow: "0 0 6px 2px rgba(201,184,255,0.5)",
              }}
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
            const theme = islandTheme[world.slug];

            return (
              <div
                key={world.id}
                className="absolute"
                style={{ left: `${world.map.x}vw`, top: `${world.map.y}%` }}
              >
                <button
                  type="button"
                  className={[
                    /* Base island styles */
                    "relative w-[20vw] max-w-[14rem] aspect-square rounded-full border-0 p-0",
                    "cursor-pointer transition-all duration-300 ease-out",
                    "hover:scale-105 hover:-translate-y-1",
                    "active:scale-95",
                    "overflow-visible",
                    /* State: locked */
                    isLocked
                      ? "grayscale-[0.6] opacity-50 cursor-not-allowed hover:scale-100 hover:translate-y-0"
                      : "",
                    /* State: current → pulsing glow ring */
                    isCurrent ? "animate-next-pulse" : "",
                    /* State: just unlocked → reveal animation */
                    justUnlocked.has(world.slug) ? "animate-unlock-reveal" : "",
                    /* State: selected → shrink + fade for transition */
                    selectedWorld === world.id
                      ? "scale-110 opacity-90"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    boxShadow: isLocked
                      ? undefined
                      : `0 0 28px 6px ${theme.glow}, 0 12px 32px rgba(40,70,120,0.18)`,
                  }}
                  onClick={() => handleIslandClick(world)}
                  onPointerEnter={() => !isLocked && prefetchWorld(world)}
                  onFocus={() => !isLocked && prefetchWorld(world)}
                  aria-label={`${worldLabels[world.slug]}${
                    isLocked ? " (bloqueado)" : isCompleted ? " (completado)" : ""
                  }`}
                  aria-disabled={isLocked}
                >
                  {/* Island thumbnail image (fills the circular button) */}
                  <img
                    src={world.thumbnail}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover rounded-full"
                  />

                  {/* Number + theme badge only on reachable islands. Locked
                      islands show just a padlock centred on the island. */}
                  {!isLocked && (
                    <span
                      className={[
                        "absolute -top-2 left-1/2 -translate-x-1/2",
                        "flex items-center gap-1 px-2.5 py-1 rounded-full",
                        "bg-gradient-to-br text-white font-display font-bold text-xs",
                        "shadow-md pointer-events-none whitespace-nowrap",
                        `bg-gradient-to-br ${theme.badge}`,
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <span>M{world.displayNumber}</span>
                      <BadgeIcon size={14} strokeWidth={2.1} />
                    </span>
                  )}

                  {/* Star chip — not shown on locked islands. */}
                  {!isLocked && (
                    <span
                      className={[
                        "absolute -bottom-3 left-1/2 -translate-x-1/2",
                        "flex items-center gap-1 px-2.5 py-1 rounded-full",
                        "text-xs font-bold whitespace-nowrap pointer-events-none",
                        "shadow-sm",
                        isCompleted
                          ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-white"
                          : "glass text-text",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <Star
                        size={14}
                        strokeWidth={2.4}
                        className={isCompleted ? "text-white" : "text-amber-400"}
                        fill={isCompleted ? "currentColor" : "none"}
                      />
                      {starInfo.earnedStars}/{starInfo.totalStars}
                    </span>
                  )}

                  {/* Completion tick — decorative, aria-label already
                      announces "completado". */}
                  {isCompleted && (
                    <span
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-emerald-500 text-white grid place-items-center shadow-md animate-tick-pop"
                      aria-hidden="true"
                    >
                      <Check size={18} strokeWidth={3.4} />
                    </span>
                  )}

                  {/* Locked islands show a padlock centred on the island. */}
                  {isLocked && (
                    <span
                      className="absolute inset-0 grid place-items-center text-white/80"
                      aria-hidden="true"
                    >
                      <Lock size={30} strokeWidth={2.5} />
                    </span>
                  )}

                  {/* Celebratory sparkle burst when this island is unlocked. */}
                  {justUnlocked.has(world.slug) && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      aria-hidden="true"
                    >
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <i
                          key={i}
                          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full animate-unlock-burst"
                          style={{
                            background: ["#c9b8ff", "#bff3ff", "#ffd9f1", "#fff8ff", "#ffe4b8", "#b8ffe4"][i],
                            animationDelay: `${i * 0.08}s`,
                            transform: `rotate(${i * 60}deg) translateY(-3rem)`,
                          }}
                        />
                      ))}
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

      {/* ── World-enter transition overlay ── */}
      <div
        className={[
          "fixed inset-0 z-40 pointer-events-none transition-all duration-500",
          selectedWorld
            ? "bg-white/90 opacity-100 backdrop-blur-sm"
            : "bg-white/0 opacity-0",
        ].join(" ")}
      />

      {/* The mascot float lives on the wrapper (animate-mascot-float).
          The <img> carries no filter so the rasterizer is not forced to
          re-blur the alpha channel of a 14–24rem tall PNG on every frame. */}
      <span className="absolute bottom-0 left-0 animate-mascot-float pointer-events-none select-none z-10">
        <img
          className="w-auto max-h-[32vh] drop-shadow-lg"
          src={assets.mascotFemaleLaptop}
          alt=""
          decoding="async"
          loading="lazy"
        />
      </span>
      <div className="absolute bottom-0 right-0 flex flex-col items-end pointer-events-none select-none z-10">
        <span
          className="glass-strong px-4 py-2 rounded-2xl rounded-br-sm text-text font-display font-bold text-sm mb-2 animate-bubble-pop shadow-md"
        >
          ¡Vamos!
        </span>
        <span className="animate-mascot-float">
          <img
            className="w-auto max-h-[32vh] drop-shadow-lg"
            src={assets.mascotMaleProud}
            alt=""
            decoding="async"
            loading="lazy"
          />
        </span>
      </div>

      <Toast message={message} />
    </main>
  );
}
