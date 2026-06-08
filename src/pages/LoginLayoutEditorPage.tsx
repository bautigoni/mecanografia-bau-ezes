import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, RotateCcw, Check } from "lucide-react";
import { assets } from "../utils/assets";

/* =====================================================================
   Login layout editor (superadmin / dev only).

   A SELF-CONTAINED sandbox that mirrors the login screen so you can drag
   the two mascots around and read off their exact position values. It does
   NOT import or modify `LoginPage` — it just renders the same background +
   mascot art on its own canvas. When you find positions you like, copy the
   generated Tailwind classes and ask to apply them to the real login.

   Nothing here is wired into the live login; this screen is a ruler, not a
   setting. Positions are remembered in localStorage only for this editor.
===================================================================== */

type Anchor = "left" | "right";

interface RobotState {
  /** Vertical offset from the bottom edge, in vh. */
  bottomVh: number;
  /** Horizontal offset from the anchored edge, in vw. */
  edgeVw: number;
  /** Rendered height, in vh (mirrors the login's `max-h-[..vh]`). */
  heightVh: number;
}

/* Defaults mirror the CURRENT login (LoginPage.tsx) so the editor opens
   matching what's live. These are read-only references — editing here never
   touches the login. */
const DEFAULTS: Record<"female" | "male", RobotState & { anchor: Anchor }> = {
  female: { anchor: "left", bottomVh: 10, edgeVw: 2, heightVh: 64 },
  male: { anchor: "right", bottomVh: 12, edgeVw: 2, heightVh: 60 },
};

const STORAGE_KEY = "typely.loginEditor.v1";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function LoginLayoutEditorPage() {
  const navigate = useNavigate();
  const [female, setFemale] = useState<RobotState>(DEFAULTS.female);
  const [male, setMale] = useState<RobotState>(DEFAULTS.male);
  const [copied, setCopied] = useState(false);

  /* Restore any positions saved from a previous editor session. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { female?: RobotState; male?: RobotState };
      if (parsed.female) setFemale(parsed.female);
      if (parsed.male) setMale(parsed.male);
    } catch {
      /* ignore corrupt state */
    }
  }, []);

  /* Persist (editor-only — does not affect the real login). */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ female, male }));
    } catch {
      /* ignore */
    }
  }, [female, male]);

  function reset() {
    setFemale(DEFAULTS.female);
    setMale(DEFAULTS.male);
  }

  const femaleClasses = `bottom-[${round1(female.bottomVh)}vh] left-[${round1(female.edgeVw)}vw] max-h-[${round1(female.heightVh)}vh]`;
  const maleClasses = `bottom-[${round1(male.bottomVh)}vh] right-[${round1(male.edgeVw)}vw] max-h-[${round1(male.heightVh)}vh]`;

  function copyAll() {
    const text =
      `/* Mascota femenina (izquierda) */\n${femaleClasses}\n\n` +
      `/* Mascota masculina (derecha) */\n${maleClasses}\n`;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => { /* clipboard blocked — values are still visible to copy by hand */ },
    );
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      {/* Draggable mascots */}
      <DraggableRobot
        src={assets.mascotFemaleWave}
        anchor="left"
        state={female}
        onChange={setFemale}
      />
      <DraggableRobot
        src={assets.mascotMaleWave}
        anchor="right"
        state={male}
        onChange={setMale}
      />

      {/* A faint placeholder of where the login card sits, so you can judge
          the gap between the robots and the card without rendering the real
          form. Purely decorative. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,92vw)] h-[60vh] rounded-[2rem] border-2 border-dashed border-white/60 bg-white/10 backdrop-blur-[1px] grid place-items-center pointer-events-none z-10"
        aria-hidden="true"
      >
        <span className="text-white/80 font-display font-bold text-lg">Tarjeta de login (referencia)</span>
      </div>

      {/* Control panel */}
      <aside className="absolute top-4 right-4 z-30 w-[min(22rem,92vw)] glass-card-smooth p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold text-text">Editor de login</h1>
          <button
            type="button"
            onClick={() => navigate("/entrar")}
            className="flex items-center gap-1.5 text-sm font-bold text-muted hover:text-text transition cursor-pointer"
          >
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
        <p className="text-xs text-muted -mt-2">
          Arrastrá cada robot para moverlo y usá los controles para el tamaño.
          Esto es un editor: copiá los valores y pedí aplicarlos al login.
        </p>

        <RobotControls
          title="Mascota femenina (izquierda)"
          anchorLabel="left"
          state={female}
          onChange={setFemale}
          classes={femaleClasses}
        />
        <RobotControls
          title="Mascota masculina (derecha)"
          anchorLabel="right"
          state={male}
          onChange={setMale}
          classes={maleClasses}
        />

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "¡Copiado!" : "Copiar valores"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-text bg-white/50 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Restablecer"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </aside>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Draggable mascot                                                    */
/* ------------------------------------------------------------------ */
function DraggableRobot({
  src,
  anchor,
  state,
  onChange,
}: {
  src: string;
  anchor: Anchor;
  state: RobotState;
  onChange: (s: RobotState) => void;
}) {
  const dragRef = useRef<{ x: number; y: number; bottom: number; edge: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const start = dragRef.current;
      if (!start) return;
      const dXvw = ((e.clientX - start.x) / window.innerWidth) * 100;
      const dYvh = ((e.clientY - start.y) / window.innerHeight) * 100;
      // Moving the pointer down lowers the robot → bottom offset decreases.
      const bottomVh = clamp(start.bottom - dYvh, -10, 90);
      // A left-anchored robot's edge offset grows as it moves right; a
      // right-anchored one's grows as it moves left.
      const edgeVw = clamp(
        anchor === "left" ? start.edge + dXvw : start.edge - dXvw,
        -10,
        90,
      );
      onChange({ ...state, bottomVh, edgeVw });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    if (dragRef.current) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // Re-bind whenever state/anchor changes so the closure stays fresh.
  }, [state, anchor, onChange]);

  // Force the effect to re-run by toggling a counter on pointer down.
  const [, force] = useState(0);

  const style: React.CSSProperties = {
    bottom: `${state.bottomVh}vh`,
    height: `${state.heightVh}vh`,
    width: "auto",
    [anchor]: `${state.edgeVw}vw`,
  };

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onPointerDown={(e) => {
        e.preventDefault();
        dragRef.current = { x: e.clientX, y: e.clientY, bottom: state.bottomVh, edge: state.edgeVw };
        force((n) => n + 1);
      }}
      className="absolute z-20 select-none cursor-grab active:cursor-grabbing drop-shadow-lg"
      style={style}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Per-robot numeric controls                                          */
/* ------------------------------------------------------------------ */
function RobotControls({
  title,
  anchorLabel,
  state,
  onChange,
  classes,
}: {
  title: string;
  anchorLabel: "left" | "right";
  state: RobotState;
  onChange: (s: RobotState) => void;
  classes: string;
}) {
  return (
    <div className="glass-surface rounded-xl p-3 flex flex-col gap-2">
      <strong className="text-text text-sm font-extrabold">{title}</strong>
      <Slider
        label={`${anchorLabel === "left" ? "Izquierda" : "Derecha"} (vw)`}
        value={state.edgeVw}
        min={-10}
        max={60}
        onChange={(edgeVw) => onChange({ ...state, edgeVw })}
      />
      <Slider
        label="Abajo (vh)"
        value={state.bottomVh}
        min={-10}
        max={60}
        onChange={(bottomVh) => onChange({ ...state, bottomVh })}
      />
      <Slider
        label="Alto (vh)"
        value={state.heightVh}
        min={20}
        max={90}
        onChange={(heightVh) => onChange({ ...state, heightVh })}
      />
      <code className="block text-[11px] leading-snug text-accent-strong bg-white/50 rounded-lg px-2 py-1.5 break-all">
        {classes}
      </code>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-muted">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent-strong cursor-pointer"
      />
      <span className="w-10 text-right text-text tabular-nums">{round1(value)}</span>
    </label>
  );
}
