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
    <main className="i5-shell page-fade">
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
        <img className="i5-mascot i5-mascot--left" src={assets.mascotFemaleWave} alt="" />
        <span className="i5-bubble i5-bubble--left">¡Vos podés!</span>
        <img className="i5-mascot i5-mascot--right" src={assets.mascotMaleProud} alt="" />
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
  { id: "star", emoji: "⭐", tone: "gold" as const },
  { id: "apple", emoji: "🍎", tone: "pink" as const },
  { id: "bunny", emoji: "🐰", tone: "mint" as const },
  { id: "ball", emoji: "🎈", tone: "blue" as const },
  { id: "target", emoji: "🎯", tone: "violet" as const },
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
              aria-label={`Hacer clic en ${o.id}`}
            >
              <span className="i5-clickable__aura" />
              <span className="i5-clickable__emoji">{o.emoji}</span>
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

const LEVEL2_ROUNDS = [
  {
    objects: [
      { id: "penguin", emoji: "🐧" },
      { id: "backpack", emoji: "🎒" },
      { id: "chest", emoji: "🧰" },
      { id: "potion", emoji: "🧪" },
    ],
    target: "chest",
    menu: [
      { id: "open", label: "Abrir", emoji: "📦", correct: true },
      { id: "look", label: "Mirar", emoji: "👁", correct: false },
      { id: "save", label: "Guardar", emoji: "💾", correct: false },
    ],
  },
  {
    objects: [
      { id: "book", emoji: "📕" },
      { id: "crystal", emoji: "💎" },
      { id: "robot", emoji: "🤖" },
      { id: "map", emoji: "🗺" },
    ],
    target: "crystal",
    menu: [
      { id: "polish", label: "Pulir", emoji: "✨", correct: true },
      { id: "throw", label: "Tirar", emoji: "🗑", correct: false },
      { id: "hide", label: "Esconder", emoji: "🙈", correct: false },
    ],
  },
  {
    objects: [
      { id: "cup", emoji: "🥤" },
      { id: "key", emoji: "🗝" },
      { id: "cake", emoji: "🍰" },
      { id: "ship", emoji: "🚀" },
    ],
    target: "key",
    menu: [
      { id: "use", label: "Usar", emoji: "🔓", correct: true },
      { id: "copy", label: "Copiar", emoji: "📋", correct: false },
      { id: "lose", label: "Perder", emoji: "💨", correct: false },
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
      instruction="Hacé clic derecho sobre el objeto correcto."
      goal="Hacé click derecho sobre el objeto correcto"
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
                aria-label={o.id}
              >
                <span className="i5-clickable__aura" />
                <span className="i5-clickable__emoji">{o.emoji}</span>
                <span className="i5-clickable__pedestal" />
                {isTarget && <span className="i5-clickable__hint">click derecho</span>}
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
  { id: "star", emoji: "⭐", silhouette: "★" },
  { id: "apple", emoji: "🍎", silhouette: "🍎" },
  { id: "ball", emoji: "🎈", silhouette: "🎈" },
  { id: "bunny", emoji: "🐰", silhouette: "🐰" },
];

function DragDropLevel({ activity }: { activity: Activity }) {
  const total = LEVEL3_ITEMS.length;
  const prog = useLevelProgress(activity, total);
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | undefined>();
  const [moves, setMoves] = useState(0);

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
      setFeedback("Esa silueta no coincide. Probá otra.");
      setTimeout(() => setFeedback(undefined), 1400);
    }
  }

  function retry() {
    prog.reset();
    setPlaced({});
    setMoves(0);
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
      <div className="i5-l3-grid">
        <div className="i5-l3-col i5-l3-col--items">
          {LEVEL3_ITEMS.map((it) => (
            <div
              key={it.id}
              className={`i5-drag-item ${placed[it.id] ? "is-placed" : ""} ${dragging === it.id ? "is-dragging" : ""}`}
              draggable={!placed[it.id]}
              onDragStart={(e) => onDragStart(e, it.id)}
              onDragEnd={onDragEnd}
              aria-label={`Arrastrar ${it.id}`}
            >
              <span className="i5-drag-item__aura" />
              <span className="i5-drag-item__emoji">{it.emoji}</span>
            </div>
          ))}
        </div>
        <div className="i5-l3-path" aria-hidden="true">
          <svg viewBox="0 0 200 280" preserveAspectRatio="none">
            <path d="M 10 20 C 120 60, 80 160, 190 240" stroke="rgba(108,74,230,0.55)" strokeWidth="3" strokeDasharray="6 6" fill="none" />
            <polygon points="180,230 200,240 180,250" fill="rgba(108,74,230,0.55)" />
          </svg>
        </div>
        <div className="i5-l3-col i5-l3-col--slots">
          {LEVEL3_ITEMS.map((it) => (
            <div
              key={it.id}
              className={`i5-drop-slot ${hovered === it.id ? "is-hover" : ""} ${placed[it.id] ? "is-filled" : ""}`}
              onDragOver={(e) => onDragOver(e, it.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, it.id)}
            >
              <span className="i5-drop-slot__silhouette">{placed[it.id] ? it.emoji : it.silhouette}</span>
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
      <div className="i5-desktop">
        {windows.filter((w) => w.open).map((w) => (
          <div key={w.id} className="i5-window">
            <div className="i5-window__bar">
              {w.tabs ? (
                <>
                  {w.tabs.filter((t) => t.open).map((t) => (
                    <div key={t.id} className="i5-tab">
                      <span>{t.emoji}</span> {t.title}
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
                </>
              ) : (
                <span className="i5-window__title">
                  <span>{w.emoji}</span> {w.title}
                </span>
              )}
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
                <div className="i5-browser">
                  <div className="i5-browser__searchbar">🔍 Buscar...</div>
                  <div className="i5-browser__planet">🌍</div>
                </div>
              )}
              {w.id === "drawings" && (
                <div className="i5-drawings">
                  <div className="i5-drawings__pad">⭐ 🌸 ✏️</div>
                </div>
              )}
              {w.id === "notes" && (
                <div className="i5-notes">¡Recordá practicar todos los días! 💛</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Island5Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Level 5 — Scroll wheel + zoom                                      */
/* ------------------------------------------------------------------ */

function ScrollLevel({ activity }: { activity: Activity }) {
  const total = 3;
  const prog = useLevelProgress(activity, total);
  const [scrolls, setScrolls] = useState(0);
  const [zooms, setZooms] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [reachedTop, setReachedTop] = useState(true);
  const [didZoom, setDidZoom] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>();
  const objectivesDone = useRef<Set<string>>(new Set());

  const objectives = [
    { id: "scroll-down", text: "Hacé scroll hacia abajo hasta el final." },
    { id: "scroll-up", text: "Volvé arriba con la rueda del mouse." },
    { id: "zoom-in", text: "Acercate con el zoom +" },
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
    setZoom((z) => Math.min(z + 0.15, 1.9));
    setDidZoom(true);
    if (current.id === "zoom-in") complete("zoom-in", "¡Zoom realizado!");
  }
  function onZoomOut() {
    setZooms((z) => z + 1);
    setZoom((z) => Math.max(z - 0.15, 0.8));
  }

  function retry() {
    prog.reset();
    setScrolls(0);
    setZooms(0);
    setZoom(1);
    setReachedBottom(false);
    setReachedTop(true);
    setDidZoom(false);
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
      <div className="i5-l5-grid">
        <div className="i5-mouse-illust" aria-hidden="true">
          <div className="i5-mouse-illust__arrow i5-mouse-illust__arrow--up">↑</div>
          <div className="i5-mouse-illust__body">🖱</div>
          <div className="i5-mouse-illust__arrow i5-mouse-illust__arrow--down">↓</div>
        </div>
        <div className="i5-scroll-panel">
          <div className="i5-scroll-panel__viewport" onScroll={onScroll}>
            <div className="i5-scroll-panel__content">
              <div className="i5-scroll-card">🏰</div>
              <div className="i5-scroll-card">🌳</div>
              <div className="i5-scroll-card">⛰</div>
              <div className="i5-scroll-card">🌈</div>
              <div className="i5-scroll-card">🏰</div>
              <div className="i5-scroll-card i5-scroll-card--end">🎉</div>
            </div>
          </div>
          <div className="i5-scroll-panel__cues">
            <span>↑ SCROLL ARRIBA</span>
            <span>↓ SCROLL ABAJO</span>
          </div>
        </div>
        <div className="i5-zoom-panel">
          <div className="i5-zoom-stage">
            <div className="i5-zoom-img" style={{ transform: `scale(${zoom})` }}>🏰</div>
            <span className="i5-zoom-loupe">🔍</span>
          </div>
        </div>
        <div className="i5-zoom-buttons">
          <button type="button" className="i5-zoom-btn" onClick={onZoomIn} aria-label="Zoom in">＋<span>ZOOM IN</span></button>
          <button type="button" className="i5-zoom-btn" onClick={onZoomOut} aria-label="Zoom out">−<span>ZOOM OUT</span></button>
        </div>
      </div>
      <span className="i5-sr-only" aria-hidden="true">{didZoom ? "" : ""}{reachedTop ? "" : ""}</span>
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

