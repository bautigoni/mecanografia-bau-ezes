import { ArrowLeft, ArrowRight, Lock, MapPin, RotateCcw, Star } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { getWorldBySlug, getWorlds, worldStarProgress, WORLD_PEDAGOGY_ORDER, type Level, type LevelPosition } from "../data/worlds";
import { LevelPositionEditor } from "../components/dev/LevelPositionEditor";
import { assets } from "../utils/assets";

/* The dev level-position editor is available in local dev builds, OR when a
   superadmin entered "modo desarrollador" from the god-mode chooser (which
   sets the `typely_dev_editor` flag). Never available to normal users. */
/* The editor is ONLY available in superadmin "Modo desarrollador" (which sets
   the typely_dev_editor flag via setViewAsStored). It is NOT shown in local dev
   for the demo student, nor to any normal user. Checked dynamically because the
   flag is set after this module first loads. */
function editorAvailable(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("typely_dev_editor") === "1";
}
const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const PERSPECTIVE_BASE = { scale: 1.4, rotateX: 54.5, rotateY: -1.5, rotateZ: 2, perspective: 110 } as const;

/* ---- Island image containers (per world) — separate from the full background.
   The island PNG is centered in the viewport with object-fit: contain. Level
   nodes live inside a %-grid that matches this island container, so their
   positions stay locked to the art on every screen size. ---- */
const ISLAND_IMG: Partial<Record<string, string>> = {
  island1: "/assets/edutic-art/islands/1/island.png",
};
const ISLAND_BG: Partial<Record<string, string>> = {
  // Soft pastel sky (same backdrop as the /mundos map) — clean, no busy
  // castle islands. The island art is a separate PNG layered on top. The old
  // islands/1/background.png was a flat blue sky and looked wrong.
  island1: assets.homeBg,
};


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

/* ---- Status-pill colour map (state → Tailwind classes) ---- */
const STATUS_PILL_CLASSES: Record<string, string> = {
  actual: "bg-accent-sky text-white",
  completado: "bg-mint text-white",
  bloqueado: "bg-rose/80 text-white",
};

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
    () => editorAvailable() && new URLSearchParams(window.location.search).has("editor"),
  );
  const [gridOn, setGridOn] = useState(true);
  const [editorPositions, setEditorPositions] = useState<LevelPosition[]>([]);
  const [dragIndex, setDragIndex] = useState(-1);
  /* Mirror of the active drag index in a ref so pointermove never reads a
     stale closure value between the pointerdown and the next render. */
  const dragIndexRef = useRef(-1);
  const [cursor, setCursor] = useState<LevelPosition | null>(null);
  const [lastClick, setLastClick] = useState<LevelPosition | null>(null);
  /* Which node is selected for perspective editing (keyboard + sliders). */
  const [editorSelectedIndex, setEditorSelectedIndex] = useState(-1);
  /* Hover state for the pressed button image (disabled during editor). */
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  /* Perspective adjustment mode: null = position, otherwise the active 3D property. */
  const [perspMode, setPerspMode] = useState<"scale" | "rotateX" | "rotateY" | "rotateZ" | "persp" | null>(null);
  const [numScale, setNumScale] = useState(1);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!maybeWorld) return;
    setBgReady(false);
    const bgSrc = ISLAND_BG[maybeWorld.slug] ?? maybeWorld.background;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setBgReady(true);
    img.onerror = () => setBgReady(true);
    img.src = bgSrc;
    if (img.complete && img.naturalWidth > 0) setBgReady(true);
  }, [maybeWorld]);

  // Seed the editor draft from the saved config whenever the island changes.
  useEffect(() => {
    if (!maybeWorld) return;
    setEditorPositions(maybeWorld.levelPositions.map((p) => ({ ...p })));
  }, [maybeWorld?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the level popover when tapping anywhere that isn't a level node.
  useEffect(() => {
    if (!popoverOpen) return;
    function onDocPointerDown(event: PointerEvent) {
      const el = event.target as HTMLElement | null;
      if (el && (el.closest("[data-level-node]") || el.closest("[data-level-popover]"))) return;
      setPopoverOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [popoverOpen]);

  if (!maybeWorld) {
    return <Navigate to="/mundos" replace />;
  }

  const world = maybeWorld;

  /* ---- Island container: island.png centered via object-fit: contain.
     Pixel dimensions so the level map matches the image exactly. ---- */
  const islandImgPath = ISLAND_IMG[world.slug];
  const islandBgPath = ISLAND_BG[world.slug] ?? world.background;
  const [islandImgSize, setIslandImgSize] = useState<{ w: number; h: number } | null>(null);
  const [islandContainer, setIslandContainer] = useState<{ left: number; top: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!islandImgPath) { setIslandImgSize(null); return; }
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) setIslandImgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => setIslandImgSize(null);
    img.src = islandImgPath;
  }, [islandImgPath]);

  const computeIslandContainer = useCallback(() => {
    if (!islandImgSize) { setIslandContainer(null); return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    const iAR = islandImgSize.w / islandImgSize.h;
    const vAR = vw / vh;
    let cw: number, ch: number;
    if (vAR > iAR) { ch = vh; cw = ch * iAR; }
    else            { cw = vw; ch = cw / iAR; }
    setIslandContainer({ left: (vw - cw) / 2, top: (vh - ch) / 2, w: cw, h: ch });
  }, [islandImgSize]);

  useEffect(() => {
    computeIslandContainer();
    window.addEventListener("resize", computeIslandContainer);
    return () => window.removeEventListener("resize", computeIslandContainer);
  }, [computeIslandContainer]);

  const actualIndex = world.levels.findIndex((level) => level.state === "Actual");
  const currentIndex = actualIndex >= 0 ? actualIndex : initialIndex;
  const worldNumber = world.displayNumber;
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
  const isLastWorld = worldNumber >= WORLD_PEDAGOGY_ORDER.length;

  /* "Siguiente" CTA (moved here from the world map). It appears only when the
     student has fully finished this world: every level completed AND ≥70% of
     its stars earned AND a next world exists to go to. */
  const currentWorldIdx = allWorlds.findIndex((w) => w.slug === world.slug);
  const nextWorld = currentWorldIdx >= 0 ? allWorlds[currentWorldIdx + 1] : undefined;
  const allLevelsDone = world.levels.every((level) => level.state === "Completado");
  const canGoToNextWorld = allLevelsDone && starProgress.isUnlockedNext && Boolean(nextWorld);

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
    // In editor mode a click selects the node for perspective editing / keyboard nudging.
    if (editorOn) {
      setEditorSelectedIndex((prev) => (prev === index ? -1 : index));
      return;
    }
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
    logConfig("Click en mapa");
    try {
      await navigator.clipboard.writeText(`{ x: ${round1(p.x)}, y: ${round1(p.y)} }`);
      setMessage(`Copiado · x ${round1(p.x)} · y ${round1(p.y)}`);
    } catch {
      setMessage(`x ${round1(p.x)} · y ${round1(p.y)}`);
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
    setEditorPositions((prev) => prev.map((pos, i) => (i === index ? { ...pos, x: p.x, y: p.y } : pos)));
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
    setEditorSelectedIndex(-1);
    setPerspMode(null);
    setMessage("Posiciones restauradas a la configuración guardada.");
  }

  /** Adjust a 3D perspective property on the selected editor node. */
  const handleUpdatePerspective = useCallback(
    (index: number, field: "scale" | "rotateX" | "rotateY" | "rotateZ" | "perspective", value: number) => {
      setEditorPositions((prev) =>
        prev.map((pos, i) => (i === index ? { ...pos, [field]: value } : pos)),
      );
    },
    [],
  );

  /** Console-log the current full config so it can be hardcoded back into levelPositions.ts. */
  const logConfig = useCallback(
    (label: string) => {
      const r1 = (v: number) => Math.round(v * 10) / 10;
      const arr = activePositions.map((p) => {
        const parts: string[] = [];
        if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${r1(p.scale)}`);
        if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${r1(p.rotateX)}`);
        if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${r1(p.rotateY)}`);
        if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${r1(p.rotateZ)}`);
        if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${r1(p.perspective)}`);
        let s = `{ x: ${p.x}, y: ${p.y}`;
        if (parts.length) s += `, ${parts.join(", ")}`;
        return `  ${s} },`;
      });
      console.log(`\n// ${label} — ${world.slug} (${activePositions.length} niveles)\n[\n${arr.join("\n")}\n],\n`);
    },
    [activePositions, world.slug],
  );

  /* Keyboard shortcuts for the dev editor. */
  useEffect(() => {
    if (!editorOn) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      // Ctrl/Cmd+C: copy config to console + clipboard (always available)
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        e.preventDefault();
        logConfig("Copiado " + new Date().toLocaleTimeString());
        const r1 = (v: number) => Math.round(v * 10) / 10;
        const arr = activePositions.map((p) => {
          const parts: string[] = [];
          if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${r1(p.scale)}`);
          if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${r1(p.rotateX)}`);
          if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${r1(p.rotateY)}`);
          if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${r1(p.rotateZ)}`);
          if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${r1(p.perspective)}`);
          let s = `{ x: ${p.x}, y: ${p.y}`;
          if (parts.length) s += `, ${parts.join(", ")}`;
          return `  ${s} },`;
        });
        navigator.clipboard.writeText(`[\n${arr.join("\n")}\n],`).catch(() => {});
        return;
      }

      // Escape: deselect node + exit perspective mode
      if (e.key === "Escape") {
        setEditorSelectedIndex(-1);
        setPerspMode(null);
        return;
      }

      // Toggle keys for each 3D property
      if (e.key === "s" || e.key === "S") { e.preventDefault(); setPerspMode((p) => p === "scale" ? null : "scale"); return; }
      if (e.key === "x" || e.key === "X") { e.preventDefault(); setPerspMode((p) => p === "rotateX" ? null : "rotateX"); return; }
      if (e.key === "y" || e.key === "Y") { e.preventDefault(); setPerspMode((p) => p === "rotateY" ? null : "rotateY"); return; }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); setPerspMode((p) => p === "rotateZ" ? null : "rotateZ"); return; }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setPerspMode((p) => p === "persp" ? null : "persp"); return; }

      // Arrow keys — need a selected node
      if (editorSelectedIndex < 0) return;

      const big = e.shiftKey;
      const arrow = e.key;
      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(arrow);
      if (!isArrow) return;
      e.preventDefault();

      switch (perspMode) {
        case "scale":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const sStep = big ? 0.2 : 0.02;
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.scale ?? 1;
                const next = Math.max(0.1, Math.round((cur + (arrow === "ArrowUp" ? sStep : -sStep)) * 100) / 100);
                return { ...pos, scale: next === 1 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateX":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const d = big ? 10 : 2;
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateX ?? 0;
                const next = Math.round((cur + (arrow === "ArrowDown" ? d : -d)) * 10) / 10;
                return { ...pos, rotateX: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateY":
          if (arrow === "ArrowLeft" || arrow === "ArrowRight") {
            const d = big ? 10 : 2;
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateY ?? 0;
                const next = Math.round((cur + (arrow === "ArrowRight" ? d : -d)) * 10) / 10;
                return { ...pos, rotateY: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "rotateZ":
          if (arrow === "ArrowLeft" || arrow === "ArrowRight") {
            const d = big ? 10 : 2;
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.rotateZ ?? 0;
                const next = Math.round((cur + (arrow === "ArrowRight" ? d : -d)) * 10) / 10;
                return { ...pos, rotateZ: next === 0 ? undefined : next };
              }),
            );
          }
          return;

        case "persp":
          if (arrow === "ArrowUp" || arrow === "ArrowDown") {
            const d = big ? 100 : 20;
            setEditorPositions((prev) =>
              prev.map((pos, i) => {
                if (i !== editorSelectedIndex) return pos;
                const cur = pos.perspective ?? 500;
                const next = Math.max(50, Math.round((cur + (arrow === "ArrowUp" ? d : -d)) / 10) * 10);
                return { ...pos, perspective: next === 500 ? undefined : next };
              }),
            );
          }
          return;

        default: {
          // No perspective mode — move position
          const step = big ? 5 : 0.5;
          setEditorPositions((prev) =>
            prev.map((pos, i) => {
              if (i !== editorSelectedIndex) return pos;
              let { x, y } = pos;
              if (arrow === "ArrowLeft") x = clampPct(x - step);
              if (arrow === "ArrowRight") x = clampPct(x + step);
              if (arrow === "ArrowUp") y = clampPct(y - step);
              if (arrow === "ArrowDown") y = clampPct(y + step);
              return { ...pos, x: round1(x), y: round1(y) };
            }),
          );
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editorOn, editorSelectedIndex, perspMode, activePositions, logConfig]);

  return (
    <main
      className={`relative min-h-dvh overflow-hidden bg-cover bg-center animate-page-fade ${editorOn ? "cursor-crosshair" : ""}`}
      /* Soft pastel fallback colour behind everything: covers the pre-load
         frame and any sub-pixel gap so a white edge can never flash. */
      style={{ "--scene-bg": `url("${islandBgPath}")`, backgroundColor: "#ebe3f7" } as CSSProperties}
    >
      {/* Full-viewport background — lives OUTSIDE the aspect-locked stage so it
          always covers the whole screen (object-cover, never letterboxed).
          This is what kills the white borders during the entrance zoom and
          when navigating back to the worlds map. */}
      <img
        /* Reveal only when BOTH the background AND the island art are ready, so
           the island never pops in a frame after the bg/platforms. */
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${bgReady && (!islandImgPath || islandImgSize) ? "animate-island-zoom" : "opacity-0"}`}
        src={islandBgPath}
        alt={world.title}
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by all modern browsers
        fetchpriority="high"
      />

      {/* Aspect-ratio-locked stage: the island PNG and every level node share
          the same 16:9 coordinate system, so % positions land on the real
          painted platforms on every screen size. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="false">
        <div className="relative w-full h-full">
          {/* Island PNG — only shown when separate island art is available */}
          {islandContainer && (
            <div
              style={{
                position: "absolute",
                left: `${islandContainer.left}px`,
                top: `${islandContainer.top}px`,
                width: `${islandContainer.w}px`,
                height: `${islandContainer.h}px`,
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              <img
                src={islandImgPath}
                alt=""
                decoding="async"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                }}
              />
            </div>
          )}

          {/* Level map — always renders. Matches island container bounds when
              available, otherwise fills the viewport (old background approach). */}
          <section
            className="absolute inset-0 pointer-events-none z-10"
            aria-label="Niveles del mundo"
            ref={mapRef}
            style={
              islandContainer
                ? {
                    position: "absolute",
                    left: `${islandContainer.left}px`,
                    top: `${islandContainer.top}px`,
                    width: `${islandContainer.w}px`,
                    height: `${islandContainer.h}px`,
                  }
                : undefined
            }
          >
            {editorAvailable() && editorOn && (
              <LevelPositionEditor
                worldSlug={world.slug}
                positions={activePositions}
                levels={world.levels.map((l) => ({ activityId: l.activityId, levelNumber: l.levelNumber }))}
                cursor={cursor}
                lastClick={lastClick}
                gridOn={gridOn}
                selectedIndex={editorSelectedIndex}
                perspMode={perspMode}
                numScale={numScale}
                onNumScaleChange={setNumScale}
                onSelectIndex={setEditorSelectedIndex}
                onToggleGrid={() => setGridOn((v) => !v)}
                onReset={resetEditorPositions}
                onClose={() => setEditorOn(false)}
                onCursorMove={handleEditorCursor}
                onCopyAt={handleEditorCopyAt}
                onUpdatePerspective={handleUpdatePerspective}
                onToast={setMessage}
              />
            )}

            {/* Ship/avatar. Anchored by its BOTTOM-CENTRE just above the current
                level node (translate -50%,-100%), so making it bigger grows it
                UPWARD and it never covers the node it sits on. The bob animation
                lives on the inner <img> so it doesn't fight the positioning
                transform on the wrapper. */}
            <span
              className="absolute z-20 pointer-events-none"
              style={{ left: `${currentPosition.x}%`, top: `${currentPosition.y - 3}%`, transform: "translate(-50%,-100%)" }}
            >
              <img
                className="block w-[clamp(3.4rem,12vmin,11rem)] animate-ship-hover"
                src={shipAsset}
                alt="Nave de los estudiantes en el nivel actual"
                decoding="async"
                loading="lazy"
              />
            </span>

            {/* Track hover for pressed button state (disabled during editor). */}
            {world.levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const position = activePositions[index];
              const cssPos = { left: `${position.x}%`, top: `${position.y}%` };
              const isCompleted = level.state === "Completado";
              const isBlocked = level.state === "Bloqueado";

              /* Stored values: deltas from PERSPECTIVE_BASE (0 = base = image as rendered).
                 Scale and perspective are absolute (not relative to base). */
              const storedRx = position.rotateX ?? 0;
              const storedRy = position.rotateY ?? 0;
              const storedRz = position.rotateZ ?? 0;
              const storedScale = position.scale ?? 1;
              const storedPersp = position.perspective ?? 500;

              /* Effective (absolute) values: base + delta for rotations, absolute for scale/persp. */
              const effRx = Math.round((storedRx + PERSPECTIVE_BASE.rotateX) * 10) / 10;
              const effRy = Math.round((storedRy + PERSPECTIVE_BASE.rotateY) * 10) / 10;
              const effRz = Math.round((storedRz + PERSPECTIVE_BASE.rotateZ) * 10) / 10;
              const effScale = storedScale;
              const effPersp = storedPersp;

              /* Image delta from base: same as stored (since image was rendered at base). */
              const deltaRx = storedRx;
              const deltaRy = storedRy;
              const deltaRz = storedRz;
              const deltaScale = storedScale;

              const hasDelta = deltaScale !== 1 || deltaRx !== 0 || deltaRy !== 0 || deltaRz !== 0;

              /* Build a CSS 3D transform string. */
              const transform3d = (rx: number, ry: number, rz: number, s: number, p: number) =>
                `perspective(${p}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;

              /* Image transform: delta from base (0 = as rendered). */
              const imgTransform = hasDelta ? transform3d(deltaRx, deltaRy, deltaRz, deltaScale, effPersp) : undefined;
              /* Number transform: fixed base perspective (matches the pre-rendered
                 image) + effective scale/perspective. No dynamic rotate deltas. */
              const numTransform = `perspective(${effPersp}px) rotateX(${PERSPECTIVE_BASE.rotateX}deg) rotateY(${PERSPECTIVE_BASE.rotateY}deg) rotateZ(${PERSPECTIVE_BASE.rotateZ}deg) scale(${effScale})`;

              const numSize = `${2.3 * numScale}vmin`;

              /* State-driven visual classes for the node button. */
              const stateClass =
                level.state === "Completado"
                  ? "drop-shadow-[0_0_8px_rgba(89,205,183,0.55)]"
                  : level.state === "Bloqueado"
                    ? "opacity-60 saturate-50"
                    : "";

              return (
                <button
                  key={level.title}
                  type="button"
                  data-level-node=""
                  className={[
                    "absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto",
                    "w-[clamp(3rem,9.5vmin,9rem)] h-[clamp(3rem,9.5vmin,9rem)]",
                    "rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky",
                    "transition-opacity duration-150",
                    isSelected ? "animate-platform-pulse" : "",
                    editorOn ? "cursor-move" : "cursor-pointer",
                    dragIndex === index ? "opacity-70 cursor-grabbing" : "",
                    editorOn && editorSelectedIndex === index ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "",
                    stateClass,
                  ].filter(Boolean).join(" ")}
                  style={cssPos}
                  onClick={() => handleNodeClick(index)}
                  onDoubleClick={() => handleNodeDoubleClick(index)}
                  onPointerDown={(e) => onNodePointerDown(e, index)}
                  onPointerMove={(e) => onNodePointerMove(e, index)}
                  onPointerUp={onNodePointerUp}
                  onMouseEnter={() => { if (!editorOn) setHoveredIndex(index); }}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  aria-label={`${level.title}: ${level.name}. ${level.state}`}
                >
                  {/* Image layer: only the delta from base. */}
                  <span
                    className="absolute inset-0"
                    style={hasDelta ? { transform: imgTransform } : undefined}
                  >
                    <img
                      className={`w-full h-full object-contain ${!editorOn && hoveredIndex === index ? "hidden" : ""}`}
                      src={assets.levelButton}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                    <img
                      className={`w-full h-full object-contain ${!editorOn && hoveredIndex === index ? "" : "hidden"}`}
                      src={assets.levelButtonPressed}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                  </span>

                  {/* Number layer: fixed base perspective + scale. */}
                  <span className="absolute inset-0 flex items-center justify-center" style={{ transform: numTransform }}>
                    <span
                      className={[
                        "font-display font-black select-none",
                        isCompleted ? "text-mint" : "",
                        isBlocked ? "text-muted" : "",
                        !isCompleted && !isBlocked ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" : "",
                      ].filter(Boolean).join(" ")}
                      style={{ fontSize: numSize }}
                    >
                      {level.levelNumber}
                    </span>
                  </span>

                  {/* Status indicators — no perspective, positioned flat on the button. */}
                  {isCompleted && (
                    <span className="absolute -top-1 -right-1 text-mint drop-shadow-sm" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  )}
                  {isBlocked && (
                    <span className="absolute -top-1 -right-1 text-rose bg-white/70 rounded-full p-0.5" aria-hidden="true">
                      <Lock size={14} />
                    </span>
                  )}
                  {isCompleted && (
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-0.5 text-yellow-400 drop-shadow-sm">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star key={i} size={14} fill={i < level.stars ? "currentColor" : "none"} />
                      ))}
                    </span>
                  )}

                  {editorOn && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-white bg-black/60 px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none" aria-hidden="true">
                      {position.x} · {position.y}
                      {hasDelta ? `  s${storedScale.toFixed(1)}  rx${storedRx} ry${storedRy} rz${storedRz}` : ""}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Compact selected-level popover, anchored to the selected node.
                Opens on tap, closes on tap-outside. Hidden while editing. */}
            {!editorOn && popoverOpen && (
              <div
                data-level-popover=""
                className="absolute z-30 pointer-events-auto animate-popover-in"
                style={{
                  left: `${selectedPos.x}%`,
                  top: `${selectedPos.y}%`,
                  transform: `translate(${popoverTx}, ${popoverTy})`,
                }}
              >
                <div className="glass-card p-4 rounded-2xl min-w-[14rem] relative">
                  {/* Tail — rotated square pointing toward the node */}
                  <span
                    className={[
                      "absolute w-3 h-3 glass-card rotate-45",
                      popoverRight ? "-left-1.5" : "-right-1.5",
                      popoverVBand === "top" ? "top-3" : popoverVBand === "bottom" ? "bottom-3" : "top-1/2 -translate-y-1/2",
                    ].filter(Boolean).join(" ")}
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <strong className="font-display font-bold text-text text-base">{selectedLevel.title}</strong>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_PILL_CLASSES[popoverState] ?? "bg-accent text-white"}`}>
                      {selectedLevel.state}
                    </span>
                  </div>
                  <h3 className="text-sm text-muted mb-2">{selectedLevel.name}</h3>
                  <span className="flex gap-0.5 text-yellow-400 mb-3" aria-hidden="true">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Star key={i} size={15} fill={i < selectedLevel.stars ? "currentColor" : "none"} />
                    ))}
                  </span>
                  <Button className="w-full" onClick={openLevel}>
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

      {/* Back to worlds map */}
      <button
        type="button"
        className="fixed top-4 left-4 z-30 glass-surface rounded-xl px-3 py-2 flex items-center gap-2 text-text font-bold shadow-card hover:brightness-105 transition cursor-pointer animate-hud-in"
        onClick={() => navigate("/mundos")}
      >
        <ArrowLeft size={20} />
        <span className="text-[clamp(1rem,1.8vmin,1.35rem)]">Volver a mundos</span>
      </button>

      {editorAvailable() && (
        <button
          type="button"
          className={`fixed bottom-4 left-4 z-30 glass-surface rounded-xl px-3 py-2 flex items-center gap-2 text-text font-bold shadow-card hover:brightness-105 transition cursor-pointer ${editorOn ? "bg-accent/20 ring-2 ring-accent" : ""}`}
          onClick={() => setEditorOn((v) => !v)}
          title="Editor de posiciones de niveles (solo dev)"
        >
          <MapPin size={18} />
          <span>{editorOn ? "Cerrar editor" : "Editar niveles"}</span>
        </button>
      )}

      {/* Compact floating island header — sits in the top-safe area and never
          covers the level nodes. Replaces the old large title/progress panel. */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-b-2xl px-5 py-3 flex items-center gap-4 shadow-card animate-hud-in max-w-[92vw]">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 text-violet-700 font-bold text-[clamp(0.95rem,1.7vmin,1.3rem)] whitespace-nowrap">
          <Star size={15} fill="currentColor" />
          Mundo {worldNumber}
        </span>
        <div className="flex flex-col min-w-0">
          <h1 className="font-display font-black text-text text-[clamp(1.2rem,2.3vmin,1.8rem)] truncate">{world.title}</h1>
          <div className="flex items-center gap-3 text-[clamp(0.95rem,1.7vmin,1.3rem)]">
            <span className="inline-flex items-center gap-1 text-yellow-500 font-bold">
              <Star size={14} fill="currentColor" />
              {starProgress.earnedStars}/{starProgress.totalStars}
            </span>
            <span className="text-muted">
              {!isLastWorld && !starProgress.isUnlockedNext
                ? `Faltan ${Math.max(0, starProgress.requiredStars - starProgress.earnedStars)}★ para el próximo mundo`
                : "Tocá un nivel para jugar"}
            </span>
          </div>
        </div>
        {canGoToNextWorld && nextWorld && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white font-bold shadow-btn animate-next-pulse hover:brightness-105 transition cursor-pointer whitespace-nowrap"
            onClick={() => navigate(nextWorld.route)}
            aria-label={`Ir al siguiente mundo: ${nextWorld.title}`}
            title={`Ir a ${nextWorld.title}`}
          >
            <span>Siguiente</span>
            <ArrowRight size={18} strokeWidth={2.7} />
          </button>
        )}
      </header>

      <Toast message={message} />
    </main>
  );
}
