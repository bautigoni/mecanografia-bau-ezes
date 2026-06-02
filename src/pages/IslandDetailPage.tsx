import { ArrowLeft, ArrowRight, Lock, MapPin, RotateCcw, Star, UserRound } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { getWorldBySlug, getWorlds, worldStarProgress, type Level, type LevelPosition } from "../data/worlds";
import { LevelPositionEditor } from "../components/dev/LevelPositionEditor";
import { assets } from "../utils/assets";

/* Dev-only level-position editor is available solely in dev builds; in a
   production/student build this is false and the entire editor is tree-shaken
   out, so students never see any debug UI, grid or coordinates. */
const EDITOR_AVAILABLE = import.meta.env.DEV;

const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/* ---- Level marker icon assets (served from /public) ----
   Each state has its own high-quality WebP badge. The number in the file
   name matches the level number shown in the icon. Completed badges bake in
   the 1/2/3 star result (okay = 1★, good = 2★, perfect = 3★). */
const LEVEL_ICON_DIR = {
  available: "/typely_level_icons_webp",
  okay: "/okay_webp_icons",
  good: "/good_webp_icons",
  perfect: "/perfect_webp_icons",
} as const;
const BLOCKED_ICON = "/typely_level_icons_webp/blocked-levels.webp";

/** Resolves the badge image for a level given its state + best stars. */
function levelIconSrc(level: Pick<Level, "levelNumber" | "state" | "stars">): string {
  const n = Math.min(Math.max(level.levelNumber, 1), 8);
  if (level.state === "Bloqueado") return BLOCKED_ICON;
  if (level.state === "Completado") {
    if (level.stars >= 3) return `${LEVEL_ICON_DIR.perfect}/${n}-perfect.webp`;
    if (level.stars === 2) return `${LEVEL_ICON_DIR.good}/${n}-good.webp`;
    return `${LEVEL_ICON_DIR.okay}/${n}-okay.webp`;
  }
  // "Actual" / available but not completed → blue numbered badge.
  return `${LEVEL_ICON_DIR.available}/${n}.webp`;
}


function getShipAsset(from: LevelPosition, to?: LevelPosition) {
  if (!to) {
    return assets.shipFront;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) < 4 && dy < 0) {
    return assets.shipBack;
  }

  if (Math.abs(dx) < 4 && dy >= 0) {
    return assets.shipFront;
  }

  if (dx > 0 && Math.abs(dy) < 7) {
    return assets.shipRight;
  }

  if (dx < 0 && Math.abs(dy) < 7) {
    return assets.shipLeft;
  }

  return dx >= 0 ? assets.shipDiagonalRight : assets.shipDiagonalLeft;
}

export function IslandDetailPage() {
  const { islandId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("");
  const maybeWorld = useMemo(() => getWorldBySlug(islandId), [islandId, location.key]);
  const allWorlds = useMemo(() => getWorlds(), [location.key]);
  const initialIndex = useMemo(() => {
    if (!maybeWorld) return 0;
    const currentIdx = maybeWorld.levels.findIndex((level) => level.state === "Actual");
    if (currentIdx >= 0) return currentIdx;
    const lastCompleted = [...maybeWorld.levels].reverse().findIndex((l) => l.state === "Completado");
    if (lastCompleted >= 0) return maybeWorld.levels.length - 1 - lastCompleted;
    return 0;
  }, [maybeWorld]);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  /* Gate the entrance animation on the actual background image being
     decoded. Until it's ready we still render the whole page (so React
     can lay out level nodes etc.) but we keep the bg + animations hidden
     under a soft sky-coloured layer. Once the image fires onLoad we flip
     the flag and CSS transitions everything to its final state in one
     smooth fade — no more top-to-bottom paint of the JPEG/WebP. */
  const [bgReady, setBgReady] = useState(false);
  /* The level info popover is closed by default (least intrusive) and opens
     only when a level is tapped; tapping outside closes it again. */
  const [popoverOpen, setPopoverOpen] = useState(false);

  /* ---- Dev-only level position editor state ---- */
  const mapRef = useRef<HTMLElement>(null);
  const [editorOn, setEditorOn] = useState(
    () => EDITOR_AVAILABLE && new URLSearchParams(window.location.search).has("editor"),
  );
  const [gridOn, setGridOn] = useState(true);
  const [editorPositions, setEditorPositions] = useState<LevelPosition[]>([]);
  const [dragIndex, setDragIndex] = useState(-1);
  /* Mirror of the active drag index in a ref so pointermove never reads a
     stale closure value between the pointerdown and the next render. */
  const dragIndexRef = useRef(-1);
  const [cursor, setCursor] = useState<LevelPosition | null>(null);
  const [lastClick, setLastClick] = useState<LevelPosition | null>(null);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!maybeWorld) return;
    setBgReady(false);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setBgReady(true);
    img.onerror = () => setBgReady(true);
    img.src = maybeWorld.background;
    // If the browser had it cached we may already be complete by now.
    if (img.complete && img.naturalWidth > 0) setBgReady(true);
  }, [maybeWorld]);

  // Seed the editor draft from the saved config whenever the island changes.
  useEffect(() => {
    if (!maybeWorld) return;
    setEditorPositions(maybeWorld.levelPositions.map((p) => ({ ...p })));
  }, [maybeWorld?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload the level badge images for this island so they never flicker in.
  useEffect(() => {
    if (!maybeWorld) return;
    for (const level of maybeWorld.levels) {
      const img = new Image();
      img.decoding = "async";
      img.src = levelIconSrc(level);
    }
  }, [maybeWorld]);

  // Close the level popover when tapping anywhere that isn't a level node or
  // the popover itself.
  useEffect(() => {
    if (!popoverOpen) return;
    function onDocPointerDown(event: PointerEvent) {
      const el = event.target as HTMLElement | null;
      if (el && (el.closest(".level-node") || el.closest(".level-popover"))) return;
      setPopoverOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [popoverOpen]);

  if (!maybeWorld) {
    return <Navigate to="/mundos" replace />;
  }

  const world = maybeWorld;
  const actualIndex = world.levels.findIndex((level) => level.state === "Actual");
  const currentIndex = actualIndex >= 0 ? actualIndex : initialIndex;
  const worldNumber = allWorlds.findIndex((item) => item.slug === world.slug) + 1;
  const safeIndex = Math.min(selectedIndex, world.levels.length - 1);
  const selectedLevel = world.levels[safeIndex];
  /* While the dev editor is on, markers + ship follow the live draft so the
     person placing them sees exactly where they'll land. Otherwise the saved
     config (world.levelPositions) drives everything, unchanged. */
  const activePositions =
    editorOn && editorPositions.length === world.levelPositions.length
      ? editorPositions
      : world.levelPositions;
  const currentPosition = activePositions[currentIndex] ?? activePositions[0];
  const nextPosition = activePositions[currentIndex + 1];
  const shipAsset = getShipAsset(currentPosition, nextPosition);
  /* Star progress toward unlocking the next world (70% gate). */
  const starProgress = worldStarProgress(world.slug);
  const isLastWorld = worldNumber >= allWorlds.length;

  /* Compact selected-level popover, anchored BESIDE the selected node. The
     level paths wind mostly vertically, so opening to the side (rather than
     above/below) keeps the popover off the neighbouring nodes. It opens to
     the right for left-half nodes and to the left for right-half nodes, and
     clamps vertically so it never spills off the top/bottom edge. */
  const selectedPos = activePositions[safeIndex] ?? activePositions[0];
  const popoverRight = selectedPos.x <= 50;
  const popoverVBand: "top" | "center" | "bottom" =
    selectedPos.y < 24 ? "top" : selectedPos.y > 76 ? "bottom" : "center";
  const popoverGap = "2.6rem";
  const popoverTx = popoverRight ? popoverGap : `calc(-100% - ${popoverGap})`;
  const popoverTy =
    popoverVBand === "top" ? "-0.6rem" : popoverVBand === "bottom" ? "calc(-100% + 0.6rem)" : "-50%";
  const popoverState = selectedLevel.state.toLowerCase();

  function selectLevel(index: number) {
    const level = world.levels[index];
    setSelectedIndex(index);
    setPopoverOpen(true);

    if (level.state === "Bloqueado") {
      setMessage("Completá el nivel anterior para desbloquearlo.");
    }
  }

  /* Enters a level by index. Locked levels are blocked unless `bypassLock`
     is set (used by the hidden rapid-click dev shortcut). */
  function enterLevel(index: number, bypassLock = false) {
    const level = world.levels[index];
    if (!level) return;
    if (level.state === "Bloqueado" && !bypassLock) {
      setMessage("Completá el nivel anterior para desbloquearlo.");
      return;
    }
    navigate(`/gameplay/${level.activityId}`);
  }

  /* Rapid-click tracker for the hidden dev shortcut: 5 quick clicks on the
     same level node enter it directly, even when locked. */
  const rapidClick = useRef<{ index: number; count: number; last: number }>({ index: -1, count: 0, last: 0 });
  const RAPID_WINDOW_MS = 450;
  const RAPID_CLICK_COUNT = 5;

  function handleNodeClick(index: number) {
    // In editor mode a click is part of placing the marker — never navigate.
    if (editorOn) return;
    const now = Date.now();
    const tracker = rapidClick.current;
    if (tracker.index === index && now - tracker.last <= RAPID_WINDOW_MS) {
      tracker.count += 1;
    } else {
      tracker.count = 1;
    }
    tracker.index = index;
    tracker.last = now;

    if (tracker.count >= RAPID_CLICK_COUNT) {
      tracker.count = 0;
      tracker.index = -1;
      enterLevel(index, true); // dev/test shortcut — bypasses the lock
      return;
    }

    selectLevel(index);
  }

  /* Double-click is a normal shortcut into the level (respects the lock). */
  function handleNodeDoubleClick(index: number) {
    if (editorOn) return;
    setSelectedIndex(index);
    enterLevel(index, false);
  }

  function openLevel() {
    enterLevel(safeIndex, false);
  }

  /* ---- Dev editor: convert a client point to map % (same box the markers
     are positioned against, so what you place is exactly what renders). ---- */
  function pctFromClient(clientX: number, clientY: number): LevelPosition | null {
    const el = mapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: round1(clampPct(((clientX - r.left) / r.width) * 100)),
      y: round1(clampPct(((clientY - r.top) / r.height) * 100)),
    };
  }
  function handleEditorCursor(clientX: number, clientY: number) {
    if (clientX < -9999) {
      setCursor(null);
      return;
    }
    setCursor(pctFromClient(clientX, clientY));
  }
  async function handleEditorCopyAt(clientX: number, clientY: number) {
    const p = pctFromClient(clientX, clientY);
    if (!p) return;
    setLastClick(p);
    try {
      await navigator.clipboard.writeText(`{ x: ${p.x}, y: ${p.y} }`);
      setMessage(`Copiado · x ${p.x} · y ${p.y}`);
    } catch {
      setMessage(`x ${p.x} · y ${p.y}`);
    }
  }
  function onNodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!editorOn) return;
    event.preventDefault();
    dragIndexRef.current = index;
    setDragIndex(index);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore — capture is best-effort */
    }
  }
  function onNodePointerMove(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!editorOn || dragIndexRef.current !== index) return;
    const p = pctFromClient(event.clientX, event.clientY);
    if (!p) return;
    setCursor(p);
    setEditorPositions((prev) => prev.map((pos, i) => (i === index ? p : pos)));
  }
  function onNodePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragIndexRef.current < 0) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    dragIndexRef.current = -1;
    setDragIndex(-1);
  }
  function resetEditorPositions() {
    setEditorPositions(world.levelPositions.map((p) => ({ ...p })));
    setMessage("Posiciones restauradas a la configuración guardada.");
  }

  return (
    <main
      className={`island-detail scene-contain page-fade ${bgReady ? "is-bg-ready" : "is-bg-loading"} ${editorOn ? "is-editing-levels" : ""}`}
      style={{ "--scene-bg": `url("${world.background}")` } as CSSProperties}
    >
      {/* Aspect-ratio-locked stage: the image and every level node share the
          same 16:9 coordinate system, so % positions land on the real
          painted platforms on every screen size. */}
      <div className="island-stage" aria-hidden="false">
        <div className="island-stage__frame">
          <img
            className="island-stage__bg scene-full-image"
            src={world.background}
            alt={world.title}
            decoding="async"
            // @ts-expect-error — fetchPriority is supported by all modern browsers
            fetchpriority="high"
          />

          <section className="level-map" aria-label="Niveles del mundo" ref={mapRef}>
            {EDITOR_AVAILABLE && editorOn && (
              <LevelPositionEditor
                worldSlug={world.slug}
                positions={activePositions}
                levels={world.levels.map((l) => ({ activityId: l.activityId, levelNumber: l.levelNumber }))}
                cursor={cursor}
                lastClick={lastClick}
                gridOn={gridOn}
                onToggleGrid={() => setGridOn((v) => !v)}
                onReset={resetEditorPositions}
                onClose={() => setEditorOn(false)}
                onCursorMove={handleEditorCursor}
                onCopyAt={handleEditorCopyAt}
                onToast={setMessage}
              />
            )}

            <img
              className="level-ship"
              src={shipAsset}
              alt="Nave de los estudiantes en el nivel actual"
              decoding="async"
              loading="lazy"
              style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y - 13}%` }}
            />

            {world.levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const position = activePositions[index];
              const isCompleted = level.state === "Completado";

              return (
                <button
                  key={level.title}
                  type="button"
                  className={`level-node level-node--${level.state.toLowerCase()} ${isSelected ? "is-selected" : ""} ${editorOn ? "is-editable" : ""} ${dragIndex === index ? "is-dragging" : ""}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onClick={() => handleNodeClick(index)}
                  onDoubleClick={() => handleNodeDoubleClick(index)}
                  onPointerDown={(e) => onNodePointerDown(e, index)}
                  onPointerMove={(e) => onNodePointerMove(e, index)}
                  onPointerUp={onNodePointerUp}
                  aria-label={`${level.title}: ${level.name}. ${level.state}`}
                >
                  <img
                    className={`level-node__icon ${isCompleted ? "level-node__icon--medal" : ""}`}
                    src={levelIconSrc(level)}
                    alt=""
                    decoding="async"
                    draggable={false}
                  />
                  {editorOn && (
                    <span className="level-node__coord" aria-hidden="true">
                      {position.x} · {position.y}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Compact selected-level popover, anchored to the selected node.
                Opens on tap, closes on tap-outside. Hidden while editing. */}
            {!editorOn && popoverOpen && (
              <div
                className="level-popover"
                data-place={popoverRight ? "right" : "left"}
                data-v={popoverVBand}
                style={{
                  left: `${selectedPos.x}%`,
                  top: `${selectedPos.y}%`,
                  transform: `translate(${popoverTx}, ${popoverTy})`,
                }}
              >
                <div className="level-popover__card">
                  <span className="level-popover__tail" aria-hidden="true" />
                  <div className="level-popover__top">
                    <strong className="level-popover__num">{selectedLevel.title}</strong>
                    <span className={`status-pill status-pill--${popoverState}`}>{selectedLevel.state}</span>
                  </div>
                  <h3 className="level-popover__name">{selectedLevel.name}</h3>
                  <span className="level-popover__stars" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Star key={i} size={15} fill={i < selectedLevel.stars ? "currentColor" : "none"} />
                    ))}
                  </span>
                  <Button className="level-popover__cta" onClick={openLevel}>
                    {selectedLevel.state === "Bloqueado" ? (
                      <><Lock size={17} /> <span>Bloqueado</span></>
                    ) : selectedLevel.state === "Completado" ? (
                      <><RotateCcw size={17} /> <span>Reintentar</span></>
                    ) : (
                      <><span>Entrar al nivel</span> <ArrowRight size={18} strokeWidth={2.8} /></>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <button type="button" className="world-back-button" onClick={() => navigate("/mundos")}>
        <ArrowLeft size={23} />
        <span>Volver a mundos</span>
      </button>

      {EDITOR_AVAILABLE && (
        <button
          type="button"
          className={`level-editor-toggle ${editorOn ? "is-on" : ""}`}
          onClick={() => setEditorOn((v) => !v)}
          title="Editor de posiciones de niveles (solo dev)"
        >
          <MapPin size={18} />
          <span>{editorOn ? "Cerrar editor" : "Editar niveles"}</span>
        </button>
      )}

      {/* Compact floating island header — sits in the top-safe area and never
          covers the level nodes. Replaces the old large title/progress panel. */}
      <header className="island-hud">
        <span className="island-hud__badge">
          <Star size={15} fill="currentColor" />
          Mundo {worldNumber}
        </span>
        <div className="island-hud__body">
          <h1>{world.title}</h1>
          <div className="island-hud__meta">
            <span className="island-hud__stars">
              <Star size={14} fill="currentColor" />
              {starProgress.earnedStars}/{starProgress.totalStars}
            </span>
            <span className="island-hud__hint">
              {!isLastWorld && !starProgress.isUnlockedNext
                ? `Faltan ${Math.max(0, starProgress.requiredStars - starProgress.earnedStars)}★ para el próximo mundo`
                : "Tocá un nivel para jugar"}
            </span>
          </div>
        </div>
      </header>

      <button type="button" className="profile-bubble" aria-label="Perfil" onClick={() => setMessage("Perfil de Sofía")}>
        <UserRound size={25} />
        <span>Perfil</span>
      </button>

      <Toast message={message} />
    </main>
  );
}
