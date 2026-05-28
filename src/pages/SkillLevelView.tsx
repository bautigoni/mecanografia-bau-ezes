import { RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "../data/activities";
import { assets } from "../utils/assets";
import { markLevelComplete } from "../utils/progress";

interface SkillLevelViewProps {
  activity: Activity;
}

/* =====================================================================
   Island 5 — Mouse skills.
   Each level is its own interactive mini-game wrapped in a shared
   pastel-fantasy shell (header + scene + metrics + completion modal).
===================================================================== */
export function SkillLevelView({ activity }: SkillLevelViewProps) {
  switch (activity.levelNumber) {
    case 1:
      return <LeftClickLevel activity={activity} />;
    case 2:
      return <RightClickLevel activity={activity} />;
    case 3:
      return <DragDropLevel activity={activity} />;
    case 4:
      return <WindowsLevel activity={activity} />;
    case 5:
      return <ScrollLevel activity={activity} />;
    case 6:
      return <DoubleClickLevel activity={activity} />;
    case 7:
      return <ShortcutsLevel activity={activity} />;
    default:
      return <FallbackLevel activity={activity} />;
  }
}

/* ------------------------------------------------------------------ */
/* Shared shell                                                       */
/* ------------------------------------------------------------------ */

interface ShellProps {
  activity: Activity;
  kicker: string;
  title: string;
  subtitle: string;
  instruction: string;
  goal: string;
  progress: number;
  total: number;
  metrics: { left: string; leftValue: number | string; mid: string; midValue: number | string; precision: number };
  completed: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  feedback?: string;
}

function Island5Shell({
  activity,
  kicker,
  title,
  subtitle,
  instruction,
  goal,
  progress,
  total,
  metrics,
  completed,
  onRetry,
  children,
  feedback,
}: ShellProps) {
  const navigate = useNavigate();

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${title}. ${instruction}`);
    utter.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  return (
    <main className={`i5-shell i5-shell--level-${activity.levelNumber} page-fade`}>
      <div className="i5-shell__bg" aria-hidden="true" />
      <div className="i5-shell__sparkles" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`i5-sparkle i5-sparkle--${i % 5}`} />
        ))}
      </div>

      <header className="i5-shell__top">
        <div className="i5-shell__card i5-shell__card--title">
          <span className="i5-shell__kicker">{kicker}</span>
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </div>
        <button
          type="button"
          className="i5-shell__exit"
          onClick={() => navigate(`/worlds/${activity.worldId}`)}
          aria-label="Salir"
        >
          <X size={16} />
          <span>Salir</span>
        </button>
      </header>

      <div className="i5-shell__goal">
        <span className="i5-shell__goal-label">
          Objetivo {Math.min(progress + (completed ? 0 : 1), total)} / {total}
        </span>
        <h2>{goal}</h2>
      </div>

      <section className="i5-shell__stage" aria-label="Escena">
        <img className="i5-mascot i5-mascot--left" src={assets.mascotFemaleWave} alt=""  decoding="async" />
        <span className="i5-bubble i5-bubble--left">¡Vos podés!</span>
        <img className="i5-mascot i5-mascot--right" src={assets.mascotMaleProud} alt=""  decoding="async" />
        <span className="i5-bubble i5-bubble--right">¡Sos un crack!</span>

        <div className="i5-scene">{children}</div>
      </section>

      <div className="i5-shell__metrics">
        <span>★</span>
        <div><b>{metrics.left}:</b> {metrics.leftValue}</div>
        <div className="i5-divider" />
        <div><b>{metrics.mid}:</b> {metrics.midValue}</div>
        <div className="i5-divider" />
        <div><b>Precisión:</b> {metrics.precision}%</div>
        <span>★</span>
      </div>

      <footer className="i5-shell__bottom">
        <div className="i5-shell__hint">
          <span aria-hidden="true">★</span>
          {feedback ?? instruction}
        </div>
        <button type="button" className="i5-btn-ghost" onClick={speak}>
          <span aria-hidden="true">🔊</span> Escuchar consigna
        </button>
        <button type="button" className="i5-btn-ghost" onClick={onRetry}>
          <RotateCcw size={16} /> Reintentar
        </button>
      </footer>

      {completed && (
        <CompletionModal
          activity={activity}
          onRetry={onRetry}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Completion modal                                                   */
/* ------------------------------------------------------------------ */

function CompletionModal({ activity, onRetry }: { activity: Activity; onRetry: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="i5-modal" role="dialog" aria-modal="true">
      <div className="i5-modal__backdrop" />
      <div className="i5-modal__card">
        <div className="i5-modal__confetti" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className={`i5-confetti i5-confetti--${i % 6}`} />
          ))}
        </div>
        <div className="i5-modal__trophy" aria-hidden="true">🏆</div>
        <h3 className="i5-modal__title">¡Muy bien!</h3>
        <p className="i5-modal__sub">Completaste el nivel</p>
        <div className="i5-modal__stars" aria-hidden="true">
          <span>★</span><span>★</span><span>★</span>
        </div>
        <div className="i5-modal__actions">
          <button
            type="button"
            className="i5-btn-primary"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
          >
            Volver a la isla
          </button>
          <button type="button" className="i5-btn-ghost" onClick={onRetry}>
            <RotateCcw size={16} /> Repetir nivel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared progress hook                                                */
/* ------------------------------------------------------------------ */

function useLevelProgress(activity: Activity, total: number) {
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [completed, setCompleted] = useState(false);
  const persistedRef = useRef(false);

  const tickCorrect = useCallback(() => {
    setAttempts((a) => a + 1);
    setProgress((p) => {
      const next = Math.min(total, p + 1);
      if (next >= total && !persistedRef.current) {
        persistedRef.current = true;
        const acc = Math.max(
          0,
          Math.round(((attempts + 1 - errors) / Math.max(1, attempts + 1)) * 100),
        );
        markLevelComplete(activity.worldId, activity.levelNumber, acc, Math.max(1, attempts + 1));
        setCompleted(true);
      }
      return next;
    });
  }, [activity.worldId, activity.levelNumber, total, attempts, errors]);

  const tickWrong = useCallback(() => {
    setAttempts((a) => a + 1);
    setErrors((e) => e + 1);
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setAttempts(0);
    setErrors(0);
    setCompleted(false);
    persistedRef.current = false;
  }, []);

  const precision = Math.round(((attempts - errors) / Math.max(1, attempts)) * 100);
  return { progress, attempts, errors, completed, precision, tickCorrect, tickWrong, reset };
}

/* ------------------------------------------------------------------ */
/* Level 1 — Left Click                                               */
/* ------------------------------------------------------------------ */

const LEVEL1_OBJECTS = [
  { id: "star",   art: assets.i5Star,   tone: "gold" as const,   label: "Estrella" },
  { id: "apple",  art: assets.i5Apple,  tone: "pink" as const,   label: "Manzana"  },
  { id: "rabbit", art: assets.i5Rabbit, tone: "mint" as const,   label: "Conejo"   },
  { id: "ball",   art: assets.i5Ball,   tone: "blue" as const,   label: "Pelota"   },
  { id: "target", art: assets.i5Shot,   tone: "violet" as const, label: "Diana"    },
];

function LeftClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL1_OBJECTS.length;
  const prog = useLevelProgress(activity, total);
  const [popped, setPopped] = useState<Record<string, boolean>>({});
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const burstId = useRef(0);

  function onPick(id: string, ev: React.MouseEvent) {
    if (popped[id] || prog.completed) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    burstId.current += 1;
    const newBurst = { id: burstId.current, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setBursts((b) => [...b, newBurst]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== newBurst.id)), 700);
    setPopped((p) => ({ ...p, [id]: true }));
    prog.tickCorrect();
  }

  function onMiss() {
    if (prog.completed) return;
    prog.tickWrong();
  }

  function retry() {
    prog.reset();
    setPopped({});
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 1"
      title="Clickeá 5 imágenes"
      subtitle="CLICK IZQUIERDO"
      instruction="Hacé clic en los objetos que brillan."
      goal="Hacé click sobre 5 dibujos"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Clicks",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
    >
      <div className="i5-l1-floor" onClick={onMiss}>
        <div className="i5-l1-row" onClick={(e) => e.stopPropagation()}>
          {LEVEL1_OBJECTS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`i5-clickable i5-clickable--${o.tone} ${popped[o.id] ? "is-popped" : ""}`}
              onClick={(e) => onPick(o.id, e)}
              disabled={popped[o.id]}
              aria-label={`Hacer clic en ${o.label}`}
            >
              <span className="i5-clickable__aura" />
              <img className="i5-clickable__art" src={o.art} alt="" draggable={false}  decoding="async" />
              <span className="i5-clickable__pedestal" />
            </button>
          ))}
        </div>
      </div>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="i5-burst"
          style={{ left: `${b.x}px`, top: `${b.y}px`, position: "fixed" }}
          aria-hidden="true"
        />
      ))}
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 2 — Right Click                                              */
/* ------------------------------------------------------------------ */

const LEVEL2_OBJECTS = [
  { id: "penguin", art: assets.i5Penguin, label: "Pingüino" },
  { id: "bag",     art: assets.i5Bag,     label: "Mochila"  },
  { id: "chest",   art: assets.i5Chest,   label: "Cofre"    },
  { id: "potion",  art: assets.i5Potion,  label: "Poción"   },
];

const LEVEL2_ROUNDS = [
  {
    objects: LEVEL2_OBJECTS,
    target: "chest",
    targetLabel: "Cofre",
    prompt: "Hacé click derecho y abrí el cofre",
    hint: "El cofre esconde un tesoro 🪙",
    menu: [
      { id: "open", label: "Abrir cofre",  emoji: "📦", correct: true  },
      { id: "look", label: "Mirar",        emoji: "👁",  correct: false },
      { id: "save", label: "Guardar",      emoji: "💾", correct: false },
    ],
  },
  {
    objects: LEVEL2_OBJECTS,
    target: "potion",
    targetLabel: "Poción",
    prompt: "Hacé click derecho y tomate la poción",
    hint: "Una pocioncita mágica para seguir aventurando 🧪",
    menu: [
      { id: "drink", label: "Tomar poción", emoji: "🧪", correct: true  },
      { id: "throw", label: "Tirar",        emoji: "🗑",  correct: false },
      { id: "hide",  label: "Esconder",     emoji: "🙈", correct: false },
    ],
  },
  {
    objects: LEVEL2_OBJECTS,
    target: "bag",
    targetLabel: "Mochila",
    prompt: "Hacé click derecho y abrí la mochila",
    hint: "Adentro hay cosas para tu próxima misión 🎒",
    menu: [
      { id: "open", label: "Abrir mochila", emoji: "📂", correct: true  },
      { id: "tie",  label: "Atar",          emoji: "🪢", correct: false },
      { id: "burn", label: "Quemar",        emoji: "🔥", correct: false },
    ],
  },
];

function RightClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL2_ROUNDS.length;
  const prog = useLevelProgress(activity, total);
  const [roundIdx, setRoundIdx] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; onObject: string | null } | null>(null);
  const [feedback, setFeedback] = useState<string | undefined>();

  const round = LEVEL2_ROUNDS[Math.min(roundIdx, total - 1)];

  function onContext(ev: React.MouseEvent, objId: string) {
    ev.preventDefault();
    if (prog.completed) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.right - 10, y: rect.top + 12, onObject: objId });
  }

  function onLeft(ev: React.MouseEvent) {
    // a normal left-click on objects should give a gentle hint
    ev.preventDefault();
    if (prog.completed) return;
    prog.tickWrong();
    setFeedback("Probá con el botón derecho del mouse 😉");
    setTimeout(() => setFeedback(undefined), 1800);
  }

  function pickMenu(id: string) {
    if (!menu) return;
    const option = round.menu.find((m) => m.id === id);
    const correctObject = menu.onObject === round.target;
    if (option?.correct && correctObject) {
      prog.tickCorrect();
      setFeedback("¡Bien! Apareció el menú secreto.");
      setTimeout(() => {
        setRoundIdx((i) => Math.min(i + 1, total - 1));
        setFeedback(undefined);
      }, 600);
    } else {
      prog.tickWrong();
      setFeedback("Mirá bien el objeto correcto y volvé a probar.");
      setTimeout(() => setFeedback(undefined), 1600);
    }
    setMenu(null);
  }

  function retry() {
    prog.reset();
    setRoundIdx(0);
    setMenu(null);
    setFeedback(undefined);
  }

  useEffect(() => {
    function onDocClick() {
      setMenu(null);
    }
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, []);

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 2"
      title="Menú secreto"
      subtitle="CLICK DERECHO"
      instruction={round.prompt}
      goal={round.prompt}
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Intentos",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="i5-l2-floor">
        <p className="i5-l2-prompt">
          ✨ {round.prompt}
        </p>
        <p className="i5-l2-hint">{round.hint}</p>
        <p className="i5-l2-hint i5-l2-hint--touchpad">
          💻 En notebook podés hacer click derecho tocando con <strong>dos dedos</strong> en el touchpad.
        </p>
        <div className="i5-l2-row">
          {round.objects.map((o) => {
            const isTarget = o.id === round.target;
            return (
              <button
                key={o.id}
                type="button"
                className={`i5-clickable i5-clickable--violet ${isTarget ? "is-target" : ""}`}
                onContextMenu={(e) => onContext(e, o.id)}
                onClick={onLeft}
                aria-label={o.label}
              >
                <span className="i5-clickable__aura" />
                <img className="i5-clickable__art" src={o.art} alt="" draggable={false}  decoding="async" />
                <span className="i5-clickable__pedestal" />
                <span className="i5-clickable__label">{o.label}</span>
                {isTarget && <span className="i5-clickable__hint">↳ click derecho aquí</span>}
              </button>
            );
          })}
        </div>
      </div>
      {menu && (
        <ul
          className="i5-ctxmenu"
          role="menu"
          style={{ left: `${menu.x}px`, top: `${menu.y}px`, position: "fixed" }}
          onClick={(e) => e.stopPropagation()}
        >
          {round.menu.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => pickMenu(m.id)}>
                <span className="i5-ctxmenu__emoji">{m.emoji}</span>
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 3 — Drag & Drop                                              */
/* ------------------------------------------------------------------ */

const LEVEL3_ITEMS = [
  { id: "star",   art: assets.i5Star,   label: "Estrella" },
  { id: "apple",  art: assets.i5Apple,  label: "Manzana"  },
  { id: "ball",   art: assets.i5Ball,   label: "Pelota"   },
  { id: "rabbit", art: assets.i5Rabbit, label: "Conejo"   },
];

function DragDropLevel({ activity }: { activity: Activity }) {
  const total = LEVEL3_ITEMS.length;
  const prog = useLevelProgress(activity, total);
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [moves, setMoves] = useState(0);
  const [rejectingSlot, setRejectingSlot] = useState<string | null>(null);

  /* Slot order is randomised per mount so the matching isn't a trivial
     "row 1 → row 1" pairing. Stable per session via useState initializer. */
  const [slotOrder] = useState<typeof LEVEL3_ITEMS>(() => {
    const arr = [...LEVEL3_ITEMS];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // If the shuffle happens to match the source order, swap two slots.
    if (arr.every((s, i) => s.id === LEVEL3_ITEMS[i].id)) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  });

  function onDragStart(ev: React.DragEvent, id: string) {
    ev.dataTransfer.setData("text/plain", id);
    ev.dataTransfer.effectAllowed = "move";
    setDragging(id);
  }
  function onDragEnd() {
    setDragging(null);
    setHovered(null);
  }
  function onDragOver(ev: React.DragEvent, slotId: string) {
    ev.preventDefault();
    setHovered(slotId);
  }
  function onDragLeave() {
    setHovered(null);
  }
  function onDrop(ev: React.DragEvent, slotId: string) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text/plain");
    setMoves((m) => m + 1);
    setHovered(null);
    setDragging(null);
    if (id === slotId) {
      setPlaced((p) => ({ ...p, [id]: true }));
      prog.tickCorrect();
      setFeedback("¡Perfecto! Encontraste su lugar.");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("✗ Esa silueta no coincide. Probá otra ranura.");
      setRejectingSlot(slotId);
      // Quick beep via WebAudio (no external asset).
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 180;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.2);
      } catch { /* audio not available — visual feedback is enough */ }
      setTimeout(() => setRejectingSlot(null), 520);
      setTimeout(() => setFeedback(undefined), 1600);
    }
  }

  function retry() {
    prog.reset();
    setPlaced({});
    setMoves(0);
    setRejectingSlot(null);
    setFeedback(undefined);
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 3"
      title="Arrastrá y soltá"
      subtitle="DRAG & DROP"
      instruction="Arrastrá cada objeto y soltalo en el lugar correcto."
      goal="Llevá cada objeto a su lugar"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Movimientos",
        leftValue: moves,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      {/* Two-row layout: draggable items on top, mixed drop targets below.
          Keeps every item visible inside the viewport at laptop sizes. */}
      <div className="i5-l3-board">
        <div className="i5-l3-row i5-l3-row--items" role="list" aria-label="Objetos para arrastrar">
          {LEVEL3_ITEMS.map((it) => (
            <div
              key={it.id}
              role="listitem"
              className={`i5-drag-item ${placed[it.id] ? "is-placed" : ""} ${dragging === it.id ? "is-dragging" : ""}`}
              draggable={!placed[it.id]}
              onDragStart={(e) => onDragStart(e, it.id)}
              onDragEnd={onDragEnd}
              aria-label={`Arrastrar ${it.label}`}
            >
              <span className="i5-drag-item__aura" />
              <img className="i5-drag-item__art" src={it.art} alt="" draggable={false} decoding="async" />
            </div>
          ))}
        </div>
        <div className="i5-l3-arrow" aria-hidden="true">
          <span>↓ soltá acá ↓</span>
        </div>
        <div className="i5-l3-row i5-l3-row--slots" role="list" aria-label="Destinos">
          {slotOrder.map((it) => (
            <div
              key={it.id}
              role="listitem"
              className={`i5-drop-slot ${hovered === it.id ? "is-hover" : ""} ${placed[it.id] ? "is-filled" : ""} ${rejectingSlot === it.id ? "is-rejecting" : ""}`}
              onDragOver={(e) => onDragOver(e, it.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, it.id)}
            >
              <img
                className={`i5-drop-slot__art ${placed[it.id] ? "is-filled" : ""}`}
                src={it.art}
                alt=""
                draggable={false}
                decoding="async"
              />
              <span className="i5-drop-slot__label">{it.label}</span>
              {rejectingSlot === it.id && <span className="i5-drop-slot__cross" aria-hidden="true">✕</span>}
            </div>
          ))}
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 4 — Virtual desktop (windows + tabs)                         */
/* ------------------------------------------------------------------ */

interface WinState {
  id: string;
  title: string;
  emoji: string;
  open: boolean;
  tabs?: { id: string; title: string; emoji: string; open: boolean }[];
}

const LEVEL4_TASKS = [
  { kind: "close-tab", windowId: "browser", tabId: "videos", text: "Cerrá la pestaña “Videos”." },
  { kind: "close-window", windowId: "drawings", text: "Cerrá la ventana “Dibujos”." },
  { kind: "open-tab", windowId: "browser", text: "Abrí una pestaña nueva en el explorador." },
  { kind: "close-window", windowId: "notes", text: "Cerrá la ventana “Notas”." },
] as const;

function WindowsLevel({ activity }: { activity: Activity }) {
  const total = LEVEL4_TASKS.length;
  const prog = useLevelProgress(activity, total);
  const [windows, setWindows] = useState<WinState[]>(() => initialWindows());
  const [tabsOpened, setTabsOpened] = useState(0);
  const [windowsClosed, setWindowsClosed] = useState(0);
  const [feedback, setFeedback] = useState<string | undefined>();

  const task = LEVEL4_TASKS[Math.min(prog.progress, total - 1)];

  function initialWindows(): WinState[] {
    return [
      {
        id: "browser",
        title: "Explorador",
        emoji: "🌐",
        open: true,
        tabs: [
          { id: "explorer", title: "Explorador", emoji: "🌐", open: true },
          { id: "videos", title: "Videos", emoji: "▶", open: true },
        ],
      },
      { id: "drawings", title: "Dibujos", emoji: "🎨", open: true },
      { id: "notes", title: "Notas", emoji: "🗒", open: true },
    ];
  }

  function onCloseWindow(id: string) {
    if (prog.completed) return;
    if (task.kind === "close-window" && task.windowId === id) {
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, open: false } : w)));
      setWindowsClosed((c) => c + 1);
      prog.tickCorrect();
      setFeedback("¡Bien! Ventana cerrada.");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Esa no era la ventana indicada.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function onCloseTab(windowId: string, tabId: string) {
    if (prog.completed) return;
    if (task.kind === "close-tab" && task.windowId === windowId && task.tabId === tabId) {
      setWindows((ws) =>
        ws.map((w) =>
          w.id === windowId
            ? { ...w, tabs: w.tabs?.map((t) => (t.id === tabId ? { ...t, open: false } : t)) }
            : w,
        ),
      );
      prog.tickCorrect();
      setFeedback("¡Pestaña cerrada!");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Esa no era la pestaña pedida.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function onOpenTab(windowId: string) {
    if (prog.completed) return;
    if (task.kind === "open-tab" && task.windowId === windowId) {
      const newTab = { id: `new-${Date.now()}`, title: "Nueva", emoji: "✨", open: true };
      setWindows((ws) =>
        ws.map((w) => (w.id === windowId ? { ...w, tabs: [...(w.tabs ?? []), newTab] } : w)),
      );
      setTabsOpened((c) => c + 1);
      prog.tickCorrect();
      setFeedback("¡Pestaña nueva lista!");
      setTimeout(() => setFeedback(undefined), 1200);
    } else {
      prog.tickWrong();
      setFeedback("Abrí la pestaña en el explorador.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function retry() {
    prog.reset();
    setWindows(initialWindows());
    setTabsOpened(0);
    setWindowsClosed(0);
    setFeedback(undefined);
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 4"
      title="Ventanas y pestañas"
      subtitle="SISTEMA VIRTUAL"
      instruction={task.text ?? "Abrí y cerrá ventanas."}
      goal="Abrí y cerrá ventanas"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Ventanas",
        leftValue: windowsClosed,
        mid: "Pestañas",
        midValue: tabsOpened,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="i5-desktop i5-desktop--clean">
        {/* Inline task pill — the spoken consigna duplicated as a readable
            cue right above the windows so kids always know what to do. */}
        <div className="i5-desktop__task" role="status">
          <span className="i5-desktop__task-kicker">Tarea</span>
          <strong>{task.text}</strong>
        </div>

        {/* Clean, illustrated windows — bodies are CSS-only so they never
            clash with painted artwork or stack messily. */}
        <div className="i5-desktop__grid">
          {windows.filter((w) => w.open).map((w, idx) => (
            <div
              key={w.id}
              className={`i5-window i5-window--${w.id}`}
              style={{ ["--stack" as never]: idx }}
            >
              <div className="i5-window__bar">
                {w.tabs ? (
                  <div className="i5-window__tabstrip" role="tablist">
                    {w.tabs.filter((t) => t.open).map((t) => (
                      <div key={t.id} className="i5-tab">
                        <span aria-hidden="true">{t.emoji}</span> {t.title}
                        <button
                          type="button"
                          className="i5-tab__close"
                          onClick={() => onCloseTab(w.id, t.id)}
                          aria-label={`Cerrar pestaña ${t.title}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="i5-tab i5-tab--add"
                      onClick={() => onOpenTab(w.id)}
                      aria-label="Nueva pestaña"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="i5-window__title">
                    <span aria-hidden="true">{w.emoji}</span> {w.title}
                  </span>
                )}
                <span className="i5-window__lights" aria-hidden="true">
                  <i style={{ background: "#ffd552" }} />
                  <i style={{ background: "#5be8ba" }} />
                </span>
                <button
                  type="button"
                  className="i5-window__close"
                  onClick={() => onCloseWindow(w.id)}
                  aria-label={`Cerrar ${w.title}`}
                >
                  ×
                </button>
              </div>
              <div className="i5-window__body">
                {w.id === "browser" && (
                  <div className="i5-fake-browser">
                    <div className="i5-fake-browser__url">
                      <span className="i5-fake-browser__dot" />
                      typely.test/aventura
                    </div>
                    <div className="i5-fake-browser__hero">🌐</div>
                    <p>Página de inicio</p>
                  </div>
                )}
                {w.id === "drawings" && (
                  <div className="i5-fake-paint">
                    <div className="i5-fake-paint__toolbar">
                      <span style={{ background: "#ff7676" }} />
                      <span style={{ background: "#54e8c6" }} />
                      <span style={{ background: "#536bff" }} />
                      <span style={{ background: "#facc15" }} />
                    </div>
                    <div className="i5-fake-paint__canvas">🎨</div>
                  </div>
                )}
                {w.id === "notes" && (
                  <div className="i5-fake-notes">
                    <p>★ Mis tareas</p>
                    <ul>
                      <li>Estudiar mecanografía</li>
                      <li>Explorar la isla</li>
                      <li>Saludar al robot</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 5 — Scroll wheel + zoom                                      */
/* ------------------------------------------------------------------ */

function ScrollLevel({ activity }: { activity: Activity }) {
  const total = 4;
  const prog = useLevelProgress(activity, total);
  const [scrolls, setScrolls] = useState(0);
  const [zooms, setZooms] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [reachedTop, setReachedTop] = useState(true);
  const [didZoomIn, setDidZoomIn] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const objectivesDone = useRef<Set<string>>(new Set());

  /* Four-step pacing forces the kid through every gesture:
       1) scroll down to reveal the bottom of the vertical castle art,
       2) scroll back up to the top,
       3) tap "+" to zoom in,
       4) tap "−" to zoom back out. */
  const objectives = [
    { id: "scroll-down", text: "Hacé scroll hacia abajo hasta ver el final del castillo." },
    { id: "scroll-up",   text: "Subí de nuevo hasta arriba con la rueda del mouse." },
    { id: "zoom-in",     text: "Acercá la imagen tocando el botón ＋" },
    { id: "zoom-out",    text: "Ahora alejá la imagen tocando el botón −" },
  ];
  const current = objectives[Math.min(prog.progress, total - 1)];

  function complete(id: string, message: string) {
    if (objectivesDone.current.has(id)) return;
    objectivesDone.current.add(id);
    prog.tickCorrect();
    setFeedback(message);
    setTimeout(() => setFeedback(undefined), 1200);
  }

  function onScroll(ev: React.UIEvent<HTMLDivElement>) {
    const el = ev.currentTarget;
    setScrolls((s) => s + 1);
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
    const atTop = el.scrollTop <= 4;
    if (atBottom && !reachedBottom) {
      setReachedBottom(true);
      setReachedTop(false);
      if (current.id === "scroll-down") complete("scroll-down", "¡Llegaste al final!");
    }
    if (atTop && reachedBottom) {
      setReachedTop(true);
      if (current.id === "scroll-up") complete("scroll-up", "¡Volviste arriba!");
    }
  }

  function onZoomIn() {
    setZooms((z) => z + 1);
    const next = Math.min(zoom + 0.18, 2);
    setZoom(next);
    setDidZoomIn(true);
    if (current.id === "zoom-in" && next >= 1.3) complete("zoom-in", "¡Zoom in realizado!");
  }
  function onZoomOut() {
    setZooms((z) => z + 1);
    const next = Math.max(zoom - 0.18, 0.7);
    setZoom(next);
    // Only count once the kid has zoomed in first and then back out.
    if (current.id === "zoom-out" && didZoomIn && next <= 1.05) {
      complete("zoom-out", "¡Zoom out realizado!");
    }
  }

  function retry() {
    prog.reset();
    setScrolls(0);
    setZooms(0);
    setZoom(1);
    setReachedBottom(false);
    setReachedTop(true);
    setDidZoomIn(false);
    objectivesDone.current.clear();
  }

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 5"
      title="Usá la rueda"
      subtitle="SCROLL"
      instruction={current.text}
      goal="Desplazate y hacé zoom"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Scrolls",
        leftValue: scrolls,
        mid: "Zoom",
        midValue: zooms,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="i5-l5-grid i5-l5-grid--clean">
        {/* Scroll card — mouse illustration sits inside the same panel so
            arrows + scroll viewport feel like one coherent unit. */}
        <section className="i5-l5-card">
          <header className="i5-l5-card__head">
            <span className="i5-l5-card__chip">SCROLL</span>
            <h3>Rueda del mouse</h3>
          </header>
          <div className="i5-l5-card__body i5-l5-card__body--scroll">
            <aside className="i5-l5-mouse" aria-hidden="true">
              <div className="i5-l5-mouse__arrow i5-l5-mouse__arrow--up">↑</div>
              <img src={assets.i5Mouse} alt="" draggable={false}  decoding="async" />
              <div className="i5-l5-mouse__arrow i5-l5-mouse__arrow--down">↓</div>
            </aside>
            <div className="i5-l5-scrollview" onScroll={onScroll}>
              {/* The "tall vertical image" is composed in pure CSS so it
                  never depends on an external file and can never bug out
                  mid-scroll. Each band paints a different sky layer of a
                  fantasy mountain → castle → cave journey. */}
              <div className="i5-l5-scene" aria-hidden="true">
                <div className="i5-l5-scene__band i5-l5-scene__band--top">
                  <span className="i5-l5-scene__icon">☀️</span>
                  <strong>Cielo</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--clouds">
                  <span className="i5-l5-scene__icon">☁️</span>
                  <strong>Nubes</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--peak">
                  <span className="i5-l5-scene__icon">🏔️</span>
                  <strong>Montaña</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--castle">
                  <span className="i5-l5-scene__icon">🏰</span>
                  <strong>Castillo</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--forest">
                  <span className="i5-l5-scene__icon">🌲</span>
                  <strong>Bosque</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--cave">
                  <span className="i5-l5-scene__icon">🪄</span>
                  <strong>Cueva mágica</strong>
                </div>
                <div className="i5-l5-scene__band i5-l5-scene__band--end">
                  <span className="i5-l5-scene__icon">🏁</span>
                  <strong>¡Llegaste al final!</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Zoom card — castle artwork lives inside a clean stage with
            obvious + / − controls below, no overlay clash. */}
        <section className="i5-l5-card">
          <header className="i5-l5-card__head">
            <span className="i5-l5-card__chip">ZOOM</span>
            <h3>Acercá la imagen</h3>
          </header>
          <div className="i5-l5-card__body i5-l5-card__body--zoom">
            <div className="i5-l5-zoomstage">
              <img
                className="i5-l5-zoomart"
                src={assets.i5CastleSquare}
                alt="Castillo de zoom"
                draggable={false}
                style={{ transform: `scale(${zoom})` }}
               decoding="async" />
              <span className="i5-l5-zoom-pct">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="i5-l5-zoom-controls">
              <button type="button" className="i5-l5-zoom-btn" onClick={onZoomOut} aria-label="Alejar">
                <strong>−</strong><span>Alejar</span>
              </button>
              <button type="button" className="i5-l5-zoom-btn i5-l5-zoom-btn--primary" onClick={onZoomIn} aria-label="Acercar">
                <strong>+</strong><span>Acercar</span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <span className="i5-sr-only" aria-hidden="true">{didZoomIn ? "" : ""}{reachedTop ? "" : ""}</span>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 6 — Double click                                             */
/* ------------------------------------------------------------------ */

const LEVEL6_FOLDERS = [
  { id: "stars",    art: assets.i5Star,   label: "Estrellas" },
  { id: "apples",   art: assets.i5Apple,  label: "Frutas" },
  { id: "bunnies",  art: assets.i5Rabbit, label: "Conejitos" },
];

function DoubleClickLevel({ activity }: { activity: Activity }) {
  const total = LEVEL6_FOLDERS.length;
  const prog = useLevelProgress(activity, total);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | undefined>();
  const singleClickTimerRef = useRef<number | null>(null);

  function onSingleClick(id: string) {
    if (prog.completed || opened[id]) return;
    if (singleClickTimerRef.current !== null) window.clearTimeout(singleClickTimerRef.current);
    singleClickTimerRef.current = window.setTimeout(() => {
      setFeedback("Un clic solo no alcanza — necesitás otro clic enseguida.");
      prog.tickWrong();
      singleClickTimerRef.current = null;
      setTimeout(() => setFeedback(undefined), 1400);
    }, 420);
  }

  function onDoubleClick(id: string) {
    if (prog.completed || opened[id]) return;
    if (singleClickTimerRef.current !== null) {
      window.clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    setOpened((o) => ({ ...o, [id]: true }));
    prog.tickCorrect();
    setFeedback("¡Doble clic perfecto! Carpeta abierta.");
    setTimeout(() => setFeedback(undefined), 1400);
  }

  function retry() {
    if (singleClickTimerRef.current !== null) {
      window.clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    prog.reset();
    setOpened({});
    setFeedback(undefined);
  }

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current !== null) window.clearTimeout(singleClickTimerRef.current);
    };
  }, []);

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 6"
      title="Doble clic"
      subtitle="ABRÍ CARPETAS"
      instruction="Hacé doble clic sobre cada carpeta para abrirla."
      goal="Abrí las 3 carpetas con doble clic"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Errores",
        leftValue: prog.errors,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="i5-l6-grid">
        {LEVEL6_FOLDERS.map((f) => (
          <button
            type="button"
            key={f.id}
            className={`i5-folder ${opened[f.id] ? "is-open" : ""}`}
            onClick={() => onSingleClick(f.id)}
            onDoubleClick={() => onDoubleClick(f.id)}
            disabled={opened[f.id]}
            aria-label={`Doble clic en ${f.label}`}
          >
            <div className="i5-folder__tab" />
            <div className="i5-folder__body">
              {opened[f.id] ? (
                <span className="i5-folder__check">✓</span>
              ) : (
                <img src={f.art} alt="" draggable={false}  decoding="async" />
              )}
            </div>
            <span className="i5-folder__label">{f.label}</span>
            {!opened[f.id] && <span className="i5-folder__hint">doble clic</span>}
          </button>
        ))}
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 7 — Copy & paste                                             */
/* ------------------------------------------------------------------ */

const LEVEL7_SOURCE = "¡Hola, soy un mensaje mágico!";

function ShortcutsLevel({ activity }: { activity: Activity }) {
  const total = 2; // 1) copy, 2) paste
  const prog = useLevelProgress(activity, total);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const sourceRef = useRef<HTMLParagraphElement | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const progRef = useRef(prog);
  progRef.current = prog;

  /* Click/tap the source text → select it so Ctrl+C copies. */
  function selectSource() {
    const node = sourceRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /* Native copy event — fires whether the user pressed Ctrl+C or used
     the right-click menu. We treat it as the "copy" milestone. */
  useEffect(() => {
    function onCopy(ev: ClipboardEvent) {
      const sel = window.getSelection()?.toString() ?? "";
      if (!sel) return;
      // Mirror the selection into our clipboard so paste works even when the
      // browser blocks raw clipboard reads.
      ev.clipboardData?.setData("text/plain", sel);
      ev.preventDefault();
      if (sel.trim() === LEVEL7_SOURCE) {
        if (!copied) {
          setCopied(true);
          // Only counts toward the copy objective.
          if (progRef.current.progress === 0) {
            progRef.current.tickCorrect();
          }
        }
        setFeedback("¡Texto copiado! Ahora hacé Ctrl + V en la caja de abajo.");
        setTimeout(() => setFeedback(undefined), 1800);
      } else {
        setFeedback("Seleccioná el mensaje completo de arriba y volvé a copiar.");
        setTimeout(() => setFeedback(undefined), 1800);
      }
    }
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
    // We rely on refs for current progress so the listener stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copied]);

  /* Paste from the textarea. The textarea's native onPaste gives us the
     pasted text — we don't need clipboard.read() permission. */
  function onPaste(ev: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = ev.clipboardData.getData("text/plain");
    ev.preventDefault();
    if (!text) return;
    setPasted(text);
    if (text.trim() === LEVEL7_SOURCE) {
      if (!copied) {
        setFeedback("Primero copiá el mensaje con Ctrl + C de arriba.");
        setTimeout(() => setFeedback(undefined), 1800);
        return;
      }
      if (progRef.current.progress === 1) {
        progRef.current.tickCorrect();
      }
      setFeedback("¡Excelente! Copiaste y pegaste el mensaje.");
      setTimeout(() => setFeedback(undefined), 1800);
    } else {
      setFeedback("Eso no es el mismo mensaje. Copiá el de arriba.");
      setTimeout(() => setFeedback(undefined), 1800);
    }
  }

  /* Show clear feedback if the user presses Ctrl+V somewhere outside the
     textarea — guide them to click into the box first. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (progRef.current.completed) return;
      const ctrlLike = ev.ctrlKey || ev.metaKey;
      if (!ctrlLike) return;
      const key = ev.key.toLowerCase();
      if (key === "v" && document.activeElement !== pasteRef.current) {
        setFeedback("Hacé click dentro de la caja de abajo antes de pegar.");
        setTimeout(() => setFeedback(undefined), 1800);
      }
      if (key === "c" && !window.getSelection()?.toString()) {
        setFeedback("Primero seleccioná el texto de arriba (click sobre el mensaje).");
        setTimeout(() => setFeedback(undefined), 1800);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function retry() {
    prog.reset();
    setPasted("");
    setCopied(false);
    setFeedback(undefined);
    pasteRef.current && (pasteRef.current.value = "");
  }

  const stepInstruction = !copied
    ? "Hacé click en el mensaje de arriba y copialo con Ctrl + C."
    : "¡Ahora pegalo en la caja de abajo con Ctrl + V!";

  return (
    <Island5Shell
      activity={activity}
      kicker="NIVEL 7"
      title="Copiar y pegar"
      subtitle="CTRL + C / CTRL + V"
      instruction={stepInstruction}
      goal="Copiá el texto de arriba y pegalo abajo"
      progress={prog.progress}
      total={total}
      metrics={{
        left: "Intentos",
        leftValue: prog.attempts,
        mid: "Aciertos",
        midValue: prog.progress,
        precision: prog.precision,
      }}
      completed={prog.completed}
      onRetry={retry}
      feedback={feedback}
    >
      <div className="i5-l7-cp">
        <div className={`i5-l7-cp__source ${copied ? "is-copied" : ""}`}>
          <span className="i5-l7-cp__label">1 · Texto para copiar</span>
          <p
            ref={sourceRef}
            className="i5-l7-cp__text"
            onClick={selectSource}
            tabIndex={0}
            onFocus={selectSource}
          >
            {LEVEL7_SOURCE}
          </p>
          <span className="i5-l7-cp__action">
            <kbd>Ctrl</kbd><span className="i5-l7-plus">+</span><kbd>C</kbd>
          </span>
        </div>

        <div className="i5-l7-cp__middle">
          <span className="i5-l7-cp__step">2</span>
          <p>Seleccioná el mensaje, copialo y pegalo abajo.</p>
        </div>

        <div className={`i5-l7-cp__paste ${pasted && pasted.trim() === LEVEL7_SOURCE ? "is-ok" : ""}`}>
          <span className="i5-l7-cp__label">3 · Pegá acá</span>
          <textarea
            ref={pasteRef}
            className="i5-l7-cp__box"
            placeholder="Hacé click acá y presioná Ctrl + V…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            onPaste={onPaste}
            spellCheck={false}
            aria-label="Caja para pegar"
          />
          <span className="i5-l7-cp__action">
            <kbd>Ctrl</kbd><span className="i5-l7-plus">+</span><kbd>V</kbd>
          </span>
        </div>
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback (levels not yet implemented)                              */
/* ------------------------------------------------------------------ */

function FallbackLevel({ activity }: { activity: Activity }) {
  const total = 1;
  const prog = useLevelProgress(activity, total);
  return (
    <Island5Shell
      activity={activity}
      kicker={`NIVEL ${activity.levelNumber}`}
      title={activity.title}
      subtitle={activity.subtitle}
      instruction={activity.instruction}
      goal={activity.title}
      progress={prog.progress}
      total={total}
      metrics={{ left: "Intentos", leftValue: prog.attempts, mid: "Aciertos", midValue: prog.progress, precision: prog.precision }}
      completed={prog.completed}
      onRetry={() => prog.reset()}
    >
      <div className="i5-l1-floor">
        <button type="button" className="i5-clickable i5-clickable--violet" onClick={() => prog.tickCorrect()}>
          <span className="i5-clickable__aura" />
          <span className="i5-clickable__emoji">✨</span>
          <span className="i5-clickable__pedestal" />
        </button>
      </div>
    </Island5Shell>
  );
}

