import { ArrowLeft, ArrowRight, Lock, MapPin, RotateCcw, Star, UserRound } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { getWorldBySlug, getWorlds, worldStarProgress, WORLD_PEDAGOGY_ORDER, type Level, type LevelPosition } from "../data/worlds";
import { LevelPositionEditor } from "../components/dev/LevelPositionEditor";
import { assets } from "../utils/assets";

/* Dev-only level-position editor is available solely in dev builds; in a
   production/student build this is false and the entire editor is tree-shaken
   out, so students never see any debug UI, grid or coordinates. */
const EDITOR_AVAILABLE = import.meta.env.DEV;

const clampPct = (v: number) => Math.min(100, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/* Base 3D perspective the level.png / pressed_level.png images were rendered at.
   CSS transforms apply the DELTA between a level's desired perspective and this
   base, so the pre-rendered artwork stays sharp while the overlaid number text
   sits in the same 3D plane. */
const PERSPECTIVE_BASE = { scale: 1.4, rotateX: 54.5, rotateY: -1.5, rotateZ: 2, perspective: 110 } as const;

/* ---- Image-relative coordinate helpers ----
   The island background uses object-fit: cover. At non-16:9 viewports the
   image gets cropped. Level positions are stored as percentages of the IMAGE
   itself (0 = left/top edge of artwork, 100 = right/bottom edge). At render
   time we translate those to container-relative percentages for CSS. */

function getImageContentRect(
  containerW: number, containerH: number,
  imgW: number, imgH: number,
): { left: number; top: number; width: number; height: number } {
  const cAR = containerW / containerH;
  const iAR = imgW / imgH;
  if (cAR > iAR) {
    const w = containerH * iAR;
    return { left: (containerW - w) / 2, top: 0, width: w, height: containerH };
  }
  const h = containerW / iAR;
  return { left: 0, top: (containerH - h) / 2, width: containerW, height: h };
}

function imageToContainer(imageX: number, imageY: number, cr: ReturnType<typeof getImageContentRect>, cW: number, cH: number) {
  return {
    x: ((cr.left + (imageX / 100) * cr.width) / cW) * 100,
    y: ((cr.top + (imageY / 100) * cr.height) / cH) * 100,
  };
}

function containerToImage(containerX: number, containerY: number, cr: ReturnType<typeof getImageContentRect>, cW: number, cH: number) {
  return {
    x: clampPct(((containerX / 100) * cW - cr.left) / cr.width * 100),
    y: clampPct(((containerY / 100) * cH - cr.top) / cr.height * 100),
  };
}

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
  /* Which node is selected for perspective editing (keyboard + sliders). */
  const [editorSelectedIndex, setEditorSelectedIndex] = useState(-1);
  /* Hover state for the pressed button image (disabled during editor). */
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  /* Perspective adjustment mode: null = position, otherwise the active 3D property. */
  const [perspMode, setPerspMode] = useState<"scale" | "rotateX" | "rotateY" | "rotateZ" | "persp" | null>(null);
  /* Global number font-size multiplier. */
  const [numScale, setNumScale] = useState(1);
  /* Natural dimensions of the island background image, used to convert between
     image-relative and container-relative coordinates. */
  const bgImgRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  /* Recompute the image content rect whenever the container resizes. */
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setSelectedIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!maybeWorld) return;
    setBgReady(false);
    setImgNatural(null);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      setBgReady(true);
      if (img.naturalWidth > 0) setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setBgReady(true);
    img.src = maybeWorld.background;
    if (img.complete && img.naturalWidth > 0) {
      setBgReady(true);
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [maybeWorld]);

  // Track container dimensions for image-relative coordinate computation.
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      if (r.width > 0 && r.height > 0) setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    // Initial size
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setContainerSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [maybeWorld?.slug, editorOn]); // re-attach if the DOM changes (e.g. editor toggle)

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

  /* Compute the image content rect (accounting for object-fit: cover cropping)
     and a helper that converts image-relative stored positions to container-
     relative positions for CSS. */
  const imgContentRect = useMemo(() => {
    if (!containerSize || !imgNatural) return null;
    return getImageContentRect(containerSize.w, containerSize.h, imgNatural.w, imgNatural.h);
  }, [containerSize, imgNatural]);

  /** Convert a stored image-relative position to container-relative for CSS. */
  const posForCss = useCallback(
    (p: LevelPosition): { left: string; top: string } => {
      if (!imgContentRect || !containerSize) return { left: `${p.x}%`, top: `${p.y}%` };
      const c = imageToContainer(p.x, p.y, imgContentRect, containerSize.w, containerSize.h);
      return { left: `${c.x}%`, top: `${c.y}%` };
    },
    [imgContentRect, containerSize],
  );

  /** Convert a container-relative coordinate (from mouse event) to image-relative. */
  const clientToImage = useCallback(
    (clientX: number, clientY: number): LevelPosition | null => {
      const el = mapRef.current;
      if (!el || !imgContentRect || !containerSize) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const cx = clampPct(((clientX - r.left) / r.width) * 100);
      const cy = clampPct(((clientY - r.top) / r.height) * 100);
      return containerToImage(cx, cy, imgContentRect, containerSize.w, containerSize.h);
    },
    [imgContentRect, containerSize],
  );
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
    const p = clientToImage(clientX, clientY);
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
    const p = clientToImage(event.clientX, event.clientY);
    if (!p) return;
    // Use container-relative for the crosshair cursor display
    setCursor(pctFromClient(event.clientX, event.clientY));
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

            <img
              className="level-ship"
              src={shipAsset}
              alt="Nave de los estudiantes en el nivel actual"
              decoding="async"
              loading="lazy"
              style={posForCss({ ...currentPosition, y: currentPosition.y - 13 } as LevelPosition)}
            />

            {/* Track hover for pressed button state (disabled during editor). */}
            {world.levels.map((level, index) => {
              const isSelected = index === selectedIndex;
              const position = activePositions[index];
              const cssPos = posForCss(position);
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
              /* Number transform: effective absolute (base + delta) so the flat text
                 matches the pre-rendered 3D look of the artwork. */
              const numTransform = transform3d(effRx, effRy, effRz, effScale, effPersp);

              const numSize = `${1.2 * numScale}rem`;

              return (
                <button
                  key={level.title}
                  type="button"
                  className={`level-node level-node--${level.state.toLowerCase()} ${isSelected ? "is-selected" : ""} ${editorOn ? "is-editable" : ""} ${dragIndex === index ? "is-dragging" : ""} ${editorOn && editorSelectedIndex === index ? "is-editor-selected" : ""}`}
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
                    className={`level-node__layer ${hasDelta ? "level-node__layer--custom" : ""}`}
                    style={hasDelta ? { transform: imgTransform } : undefined}
                  >
                    <img
                      className={`level-node__img ${!editorOn && hoveredIndex === index ? "level-node__img--hidden" : ""}`}
                      src={assets.levelButton}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                    <img
                      className={`level-node__img level-node__img--pressed ${!editorOn && hoveredIndex === index ? "" : "level-node__img--hidden"}`}
                      src={assets.levelButtonPressed}
                      alt=""
                      decoding="async"
                      draggable={false}
                    />
                  </span>

                  {/* Number layer: base + delta composed. Uses the same delta as the
                      image layer but adds the fixed base so the number matches the
                      pre-rendered perspective. z-index keeps it always on top. */}
                  <span className="level-node__layer level-node__layer--custom level-node__layer--top" style={{ transform: numTransform }}>
                    <span
                      className={`level-node__number ${isCompleted ? "level-node__number--completed" : ""} ${isBlocked ? "level-node__number--blocked" : ""}`}
                      style={{ fontSize: numSize }}
                    >
                      {level.levelNumber}
                    </span>
                    {isCompleted && (
                      <span className="level-node__check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    )}
                    {isBlocked && (
                      <span className="level-node__lock" aria-hidden="true">
                        <Lock size={14} />
                      </span>
                    )}
                    {isCompleted && (
                      <span className="level-node__rating">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Star key={i} size={14} fill={i < level.stars ? "currentColor" : "none"} />
                        ))}
                      </span>
                    )}
                  </span>

                  {editorOn && (
                    <span className="level-node__coord" aria-hidden="true">
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
                className="level-popover"
                data-place={popoverRight ? "right" : "left"}
                data-v={popoverVBand}
                style={{
                  ...posForCss(selectedPos),
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
        {canGoToNextWorld && nextWorld && (
          <button
            type="button"
            className="island-hud__next"
            onClick={() => navigate(nextWorld.route)}
            aria-label={`Ir al siguiente mundo: ${nextWorld.title}`}
            title={`Ir a ${nextWorld.title}`}
          >
            <span>Siguiente</span>
            <ArrowRight size={18} strokeWidth={2.7} />
          </button>
        )}
      </header>

      <button type="button" className="profile-bubble" aria-label="Mi cuenta" onClick={() => navigate("/mi-cuenta")}>
        <UserRound size={25} />
        <span>Perfil</span>
      </button>

      <Toast message={message} />
    </main>
  );
}
