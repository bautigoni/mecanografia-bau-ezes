/**
 * ShortcutLevelView.tsx
 *
 * Generic keyboard-shortcut engine used by every Activity with
 * inputType === "shortcut".
 *
 * KEY SAFETY RULE: every shortcut that would normally be intercepted by the
 * browser (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+F, Alt+Tab…) is demonstrated
 * inside a VIRTUAL environment that lives entirely within this component.
 * event.preventDefault() is called on all capture-phase keydowns so the
 * real browser action never fires while this page is open.
 *
 * Virtual environments available:
 *   "text-editor"   — Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+Z / Enter / Escape
 *   "browser-tabs"  — Ctrl+T / Ctrl+W / Ctrl+Tab / Ctrl+Shift+Tab
 *   "find-box"      — Ctrl+F / Escape
 *   "app-switcher"  — Alt+Tab  (simulated + fallback on-screen button)
 *   "doc-editor"    — Ctrl+S / Ctrl+Y  (save / redo)
 *   "dialog"        — Enter / Escape
 */

import { Monitor, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { getStarsFromAccuracy, markLevelComplete } from "../utils/progress";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type VirtualEnvKind =
  | "text-editor"
  | "browser-tabs"
  | "find-box"
  | "doc-editor"
  | "app-switcher"
  | "dialog";

type Combo = {
  raw: string;
  mods: string[];   // "Ctrl" | "Shift" | "Alt"
  key: string;      // e.g. "C", "Tab", "Enter"
  caps: string[];   // ordered keycap labels
  env: VirtualEnvKind;
};

/* ------------------------------------------------------------------ */
/* Combo parsing                                                       */
/* ------------------------------------------------------------------ */
const MOD_TOKENS = new Set(["ctrl", "control", "shift", "alt", "meta", "cmd"]);

function comboEnv(mods: string[], key: string): VirtualEnvKind {
  const k = key.toLowerCase();
  if (mods.includes("Alt") && k === "tab") return "app-switcher";
  if (mods.includes("Ctrl")) {
    if (k === "t" || k === "w" || k === "tab") return "browser-tabs";
    if (k === "f") return "find-box";
    if (k === "s" || k === "y") return "doc-editor";
    if (k === "c" || k === "v" || k === "a" || k === "z") return "text-editor";
  }
  if (k === "enter" || k === "escape") return "dialog";
  return "text-editor";
}

/* Clear, simulator-safe copy per combo (§6) — never just "hacé el atajo". */
function comboActionHint(combo: Combo): string {
  const k = combo.key.toLowerCase();
  if (combo.mods.includes("Alt") && k === "tab") return "Cambiá de ventana en el simulador (o tocá las teclas).";
  if (combo.mods.includes("Ctrl")) {
    if (k === "t") return "Creá una pestaña dentro del simulador.";
    if (k === "w") return "Cerrá la pestaña del simulador.";
    if (k === "tab") return combo.mods.includes("Shift") ? "Volvé a la pestaña anterior del simulador." : "Cambiá de pestaña en el simulador.";
    if (k === "a") return "Seleccioná todo el texto del cuadro.";
    if (k === "c") return "Copiá el texto seleccionado.";
    if (k === "v") return "Pegá el texto en el área de trabajo.";
    if (k === "z") return "Deshacé el último cambio.";
    if (k === "y") return "Rehacé el cambio en el simulador.";
    if (k === "f") return "Abrí el buscador del simulador.";
    if (k === "s") return "Guardá el documento del simulador.";
    if (k === "n") return "Abrí una ventana nueva en el simulador.";
  }
  if (k === "enter") return "Aceptá con Enter en el simulador.";
  if (k === "escape") return "Cerrá con Escape en el simulador.";
  return "Hacé el atajo dentro del simulador.";
}

function parseCombo(raw: string): Combo {
  const tokens = raw.split("+").map((t) => t.trim()).filter(Boolean);
  const mods: string[] = [];
  let key = "";
  for (const token of tokens) {
    const low = token.toLowerCase();
    if (MOD_TOKENS.has(low)) {
      if (["ctrl", "control", "meta", "cmd"].includes(low)) mods.push("Ctrl");
      else if (low === "shift") mods.push("Shift");
      else if (low === "alt") mods.push("Alt");
    } else {
      key = token;
    }
  }
  return { raw, mods, key, caps: [...mods, key], env: comboEnv(mods, key) };
}

function eventMatchesCombo(ev: KeyboardEvent, combo: Combo): boolean {
  if (combo.mods.includes("Ctrl") !== (ev.ctrlKey || ev.metaKey)) return false;
  if (combo.mods.includes("Shift") !== ev.shiftKey) return false;
  if (combo.mods.includes("Alt") !== ev.altKey) return false;
  return ev.key.toLowerCase() === combo.key.toLowerCase();
}

/* A keydown whose key is *only* a modifier (Ctrl / Shift / Alt / Meta). These
   must never count as an attempt — a shortcut isn't formed until the action
   key is pressed. */
function isModifierOnly(ev: KeyboardEvent): boolean {
  return ev.key === "Control" || ev.key === "Shift" || ev.key === "Alt" || ev.key === "Meta" || ev.key === "OS";
}

/* Returns a normalized combo string ("ctrl+a", "alt+tab", "enter"…) when the
   keydown forms a FULL shortcut attempt, or null when it should be ignored for
   scoring (a lone modifier, or a plain key with no modifier that isn't
   Enter/Escape). */
function normalizeShortcut(ev: KeyboardEvent): string | null {
  if (isModifierOnly(ev)) return null;
  const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
  const key = ev.key;
  const isStandalone = key === "Enter" || key === "Escape";
  if (!hasMod && !isStandalone) return null; // plain key → not a shortcut attempt
  const parts: string[] = [];
  if (ev.ctrlKey || ev.metaKey) parts.push("ctrl");
  if (ev.shiftKey) parts.push("shift");
  if (ev.altKey) parts.push("alt");
  parts.push(key.toLowerCase());
  return parts.join("+");
}

/* Runs the simulator's visual action when the parent signals a correct combo
   was performed via the real keyboard or the on-screen keycaps — so those
   paths update the simulation exactly like clicking the action button does.
   The env remounts per combo, so we baseline the signal on mount and only fire
   when it next increments. */
function useKeyboardTrigger(signal: number, act: () => void) {
  const baseline = useRef(signal);
  useEffect(() => {
    if (signal > baseline.current) {
      baseline.current = signal;
      act();
    }
    // act is captured from the latest render; deps intentionally only [signal].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
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
  const attemptsRef = useRef(0);
  const errorsRef = useRef(0);
  attemptsRef.current = attempts;
  errorsRef.current = errors;

  const tickCorrect = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setProgress((p) => {
      const next = Math.min(total, p + 1);
      if (next >= total && !persistedRef.current) {
        persistedRef.current = true;
        const a = attemptsRef.current;
        const e = errorsRef.current;
        const acc = Math.max(0, Math.round(((a - e) / Math.max(1, a)) * 100));
        markLevelComplete(activity.worldId, activity.levelNumber, acc, Math.max(1, a));
        setCompleted(true);
      }
      return next;
    });
  }, [activity.worldId, activity.levelNumber, total]);

  const tickWrong = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setErrors((e) => { errorsRef.current = e + 1; return e + 1; });
  }, []);

  const reset = useCallback(() => {
    persistedRef.current = false;
    setProgress(0); setAttempts(0); setErrors(0); setCompleted(false);
  }, []);

  const precision = Math.round(
    ((attempts - errors) / Math.max(1, attempts)) * 100,
  );
  return { progress, attempts, errors, completed, precision, tickCorrect, tickWrong, reset };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export function ShortcutLevelView({ activity }: { activity: Activity }) {
  const navigate = useNavigate();
  const combos = activity.targets.map(parseCombo);
  const total = combos.length;
  const background = getGameplayBackground(activity.worldId);
  const prog = useLevelProgress(activity, total);
  const progressRef = useRef(0);
  progressRef.current = prog.progress;

  const [clicked, setClicked] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | undefined>();
  const [kbTrigger, setKbTrigger] = useState(0);
  const feedbackTimer = useRef<number | null>(null);
  /* Set while the just-performed action is being shown before advancing, so a
     single combo can't be scored twice during the short pause. */
  const advancingRef = useRef(false);

  function flash(msg: string) {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setFeedback(msg);
    feedbackTimer.current = window.setTimeout(() => setFeedback(undefined), 1800);
  }

  /* Called by the simulator's act() once it has performed the visual action.
     We hold ~450 ms so the result (selected text, new tab…) is visible, then
     advance. The guard makes ONE combo = ONE scored attempt. */
  function succeed() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    flash("¡Muy bien!");
    window.setTimeout(() => {
      setClicked({});
      prog.tickCorrect();
      advancingRef.current = false;
    }, 450);
  }
  function fail() {
    if (advancingRef.current) return;
    flash("Casi… probá el atajo que se muestra.");
    prog.tickWrong();
  }

  /* A correct combo (keyboard or keycaps) tells the live simulator to perform
     its visual action; the simulator then calls succeed(). This keeps ONE
     code path for visual + scoring. */
  function triggerVirtualAction() {
    if (advancingRef.current) return;
    setKbTrigger((t) => t + 1);
  }

  /* ---- Physical keyboard handler ----
     Captures shortcuts INSIDE the game so the browser/OS never runs them:
       - Ctrl+T won't open a tab, Ctrl+W won't close it, Ctrl+A won't select
         the page, Alt+Tab won't switch apps (best effort — see §5).
     Scoring rule: ONE full combo = ONE attempt. Lone modifiers never count. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (prog.completed) return;
      const current = combos[progressRef.current];
      if (!current) return;

      const modifierOnly = isModifierOnly(ev);
      const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
      const blockable =
        hasMod || modifierOnly ||
        ["Tab", "Enter", "Escape", "F1", "F2", "F3", "F4", "F5", "F6",
          "F7", "F8", "F9", "F10", "F11", "F12"].includes(ev.key);
      // Block the browser/OS default for anything shortcut-like.
      if (blockable) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      // Only EVALUATE a full combo. Lone Ctrl/Shift/Alt, or a plain key with
      // no modifier (other than Enter/Escape), are ignored for scoring.
      const combo = normalizeShortcut(ev);
      if (!combo) return;

      if (eventMatchesCombo(ev, current)) {
        triggerVirtualAction(); // visual action → succeed()
      } else {
        fail();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog.completed, combos]);

  /* ---- On-screen keycap clicking (always works, even when OS intercepts) ----
     Completing the keycap combo also drives the visual simulator action. */
  function onKeycapClick(capIdx: number, label: string) {
    if (prog.completed) return;
    const current = combos[prog.progress];
    if (!current) return;
    const key = `${capIdx}:${label}`;
    const next = { ...clicked, [key]: true };
    const allDone = current.caps.every((c, i) => next[`${i}:${c}`]);
    if (allDone) {
      triggerVirtualAction(); // visual action → succeed()
    } else {
      setClicked(next);
    }
  }

  function retry() {
    prog.reset();
    setClicked({});
    setFeedback(undefined);
  }

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${activity.title}. ${activity.listenText}`);
    utter.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  const current = combos[Math.min(prog.progress, total - 1)];

  return (
    <main className="i5-shell sc-shell page-fade">
      {/* Per-world background with pastel overlay */}
      <div className="sc-bg" style={{ backgroundImage: `url("${background}")` }} aria-hidden="true" />
      <div className="i5-shell__sparkles" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`i5-sparkle i5-sparkle--${i % 5}`} />
        ))}
      </div>

      {/* Header */}
      <header className="i5-shell__top">
        <div className="i5-shell__card i5-shell__card--title">
          <span className="i5-shell__kicker">NIVEL {activity.levelNumber}</span>
          <strong>{activity.title}</strong>
          <em>{activity.subtitle}</em>
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

      {/* Goal strip */}
      <div className="i5-shell__goal">
        <span className="i5-shell__goal-label">
          Atajo {Math.min(prog.progress + (prog.completed ? 0 : 1), total)} / {total}
        </span>
        <h2>{activity.instruction}</h2>
      </div>

      {/* Stage: mascots + virtual environment */}
      <section className="i5-shell__stage" aria-label="Escena">
        <img className="i5-mascot i5-mascot--left" src={assets.mascotFemaleWave} alt="" decoding="async" />
        <span className="i5-bubble i5-bubble--left">¡Vos podés!</span>
        <img className="i5-mascot i5-mascot--right" src={assets.mascotMaleProud} alt="" decoding="async" />
        <span className="i5-bubble i5-bubble--right">¡Sos un crack!</span>

        <div className="i5-scene sc-scene">
          {/* key={prog.progress} forces a fresh mount for each new combo so
              virtual-env state (open tabs, dialog state, etc.) resets cleanly. */}
          <VirtualEnv
            key={prog.progress}
            combo={current}
            progress={prog.progress}
            completed={prog.completed}
            triggerSignal={kbTrigger}
            onVirtualAction={succeed}
          />

          {/* Keycap display (always shown as the safe fallback) */}
          <div className="sc-keycap-area">
            <span className="sc-hint">
              <Monitor size={16} />
              {current ? comboActionHint(current) : "Hacé el atajo dentro del simulador."}
            </span>
            <span className="sc-hint sc-hint--sub">Usá las teclas del juego o el teclado.</span>
            <div className="sc-combo" aria-label={`Atajo: ${current?.raw ?? ""}`}>
              {current?.caps.map((cap, i) => (
                <span key={`${i}:${cap}`} className="sc-combo__group">
                  <button
                    type="button"
                    className={`sc-key ${clicked[`${i}:${cap}`] ? "is-pressed" : ""}`}
                    onClick={() => onKeycapClick(i, cap)}
                    tabIndex={-1}
                  >
                    {cap}
                  </button>
                  {i < current.caps.length - 1 && (
                    <span className="sc-plus">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics bar */}
      <div className="i5-shell__metrics">
        <span>★</span>
        <div><b>Intentos:</b> {prog.attempts}</div>
        <div className="i5-divider" />
        <div><b>Aciertos:</b> {prog.progress}</div>
        <div className="i5-divider" />
        <div><b>Precisión:</b> {prog.precision}%</div>
        <span>★</span>
      </div>

      {/* Footer */}
      <footer className="i5-shell__bottom">
        <div className="i5-shell__hint">
          <span aria-hidden="true">★</span>
          {feedback ?? activity.description}
        </div>
        <button type="button" className="i5-btn-ghost" onClick={speak}>
          <span aria-hidden="true">🔊</span> Escuchar consigna
        </button>
        <button type="button" className="i5-btn-ghost" onClick={retry}>
          <RotateCcw size={16} /> Reintentar
        </button>
      </footer>

      {/* Completion modal */}
      {prog.completed && (
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
              {[1, 2, 3].map((i) => {
                const earned = getStarsFromAccuracy(prog.precision);
                return <span key={i} className={earned >= i ? "" : "is-empty"}>{earned >= i ? "★" : "☆"}</span>;
              })}
            </div>
            <div className="i5-modal__actions">
              <button
                type="button"
                className="i5-btn-primary"
                onClick={() => navigate(`/worlds/${activity.worldId}`)}
              >
                Volver a la isla
              </button>
              <button type="button" className="i5-btn-ghost" onClick={retry}>
                <RotateCcw size={16} /> Repetir nivel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================================== */
/* Virtual Environment — renders the simulated context for each combo  */
/* ================================================================== */

interface VirtualEnvProps {
  combo: Combo | undefined;
  progress: number;
  completed: boolean;
  triggerSignal: number;
  onVirtualAction: () => void;
}

type EnvProps = { combo: Combo; completed: boolean; triggerSignal: number; onAction: () => void };

function VirtualEnv({ combo, completed, triggerSignal, onVirtualAction }: VirtualEnvProps) {
  if (!combo) return null;
  const props: EnvProps = { combo, completed, triggerSignal, onAction: onVirtualAction };
  switch (combo.env) {
    case "browser-tabs":
      return <VirtualBrowser {...props} />;
    case "find-box":
      return <VirtualFindBox {...props} />;
    case "app-switcher":
      return <VirtualAppSwitcher {...props} />;
    case "doc-editor":
      return <VirtualDocEditor {...props} />;
    case "dialog":
      return <VirtualDialog {...props} />;
    default:
      return <VirtualTextEditor {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/* Virtual Browser (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab)         */
/* ------------------------------------------------------------------ */
function VirtualBrowser({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [tabs, setTabs] = useState(["Inicio", "Música", "Juegos"]);
  const [active, setActive] = useState(0);
  const [justActed, setJustActed] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act("kbd"));

  function act(label: string) {
    if (completed || justActed) return;
    setJustActed(true);
    window.setTimeout(() => setJustActed(false), 600);

    const key = combo.key.toLowerCase();
    const hasShift = combo.mods.includes("Shift");

    if (key === "t") {
      setTabs((prev) => [...prev, `Pestaña ${prev.length + 1}`]);
      setActive((prev) => tabs.length); // new tab at end
      onAction();
    } else if (key === "w") {
      setTabs((prev) => {
        if (prev.length <= 1) { onAction(); return prev; }
        const next = prev.filter((_, i) => i !== active);
        setActive(Math.min(active, next.length - 1));
        onAction();
        return next;
      });
    } else if (key === "tab") {
      setTabs((prev) => {
        if (hasShift) {
          setActive((a) => (a - 1 + prev.length) % prev.length);
        } else {
          setActive((a) => (a + 1) % prev.length);
        }
        onAction();
        return prev;
      });
    } else {
      onAction();
    }
    void label;
  }

  const actionLabel =
    combo.key.toLowerCase() === "t" ? "Abrir pestaña" :
    combo.key.toLowerCase() === "w" ? "Cerrar pestaña" :
    "Cambiar pestaña";

  return (
    <div className="sc-venv sc-browser">
      <div className="sc-browser__bar">
        {tabs.map((tab, i) => (
          <button
            key={`${tab}-${i}`}
            type="button"
            className={`sc-browser__tab ${i === active ? "is-active" : ""} ${justActed && i === active ? "just-acted" : ""}`}
            onClick={() => setActive(i)}
          >
            {tab}
            {tabs.length > 1 && (
              <span
                className="sc-browser__tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  if (combo.key.toLowerCase() === "w") act("close");
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="sc-browser__new-tab"
          onClick={() => combo.key.toLowerCase() === "t" && act("new")}
        >
          +
        </button>
      </div>
      <div className="sc-browser__content">
        <p className="sc-browser__page-title">{tabs[active]}</p>
        <p className="sc-browser__hint">Contenido de la página</p>
      </div>
      <button
        type="button"
        className={`sc-venv-btn ${justActed ? "is-active" : ""}`}
        onClick={() => act("click")}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Find Box (Ctrl+F, Escape)                                   */
/* ------------------------------------------------------------------ */
function VirtualFindBox({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "f") {
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 50);
      onAction();
    } else if (k === "escape" && open) {
      setOpen(false);
      onAction();
    } else if (!open) {
      onAction();
    }
  }

  const SAMPLE = "El gato saltó sobre la mesa. El perro corrió por el jardín. El niño leyó un libro.";

  return (
    <div className="sc-venv sc-find">
      <div className="sc-find__page">
        <p>{SAMPLE}</p>
        {open && (
          <div className="sc-find__box">
            <input
              ref={inputRef}
              className="sc-find__input"
              placeholder="Buscar en la página…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="sc-find__close" onClick={() => { setOpen(false); setQuery(""); }}>
              ×
            </button>
          </div>
        )}
      </div>
      <button type="button" className={`sc-venv-btn ${open ? "is-active" : ""}`} onClick={act}>
        {combo.key.toLowerCase() === "f"
          ? open ? "Buscar abierto ✓" : "Abrir buscador"
          : "Cerrar buscador"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual App Switcher (Alt+Tab — simulated, OS-safe)                 */
/* ------------------------------------------------------------------ */
const VIRT_APPS = ["TYPELY", "Música", "Notas", "Dibujo"];

function VirtualAppSwitcher({ completed, triggerSignal, onAction }: EnvProps) {
  const [focused, setFocused] = useState(0);
  const [switching, setSwitching] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    setSwitching(true);
    const next = (focused + 1) % VIRT_APPS.length;
    setFocused(next);
    window.setTimeout(() => setSwitching(false), 400);
    onAction();
  }

  return (
    <div className="sc-venv sc-appsw">
      <p className="sc-appsw__label">Ventanas abiertas:</p>
      <div className="sc-appsw__apps">
        {VIRT_APPS.map((app, i) => (
          <div
            key={app}
            className={`sc-appsw__app ${i === focused ? "is-focused" : ""} ${switching && i === focused ? "is-switching" : ""}`}
          >
            <span className="sc-appsw__icon">{["🎮","🎵","📝","🎨"][i]}</span>
            <span>{app}</span>
          </div>
        ))}
      </div>
      <button type="button" className={`sc-venv-btn ${switching ? "is-active" : ""}`} onClick={act}>
        Cambiar ventana (Alt + Tab)
      </button>
      <p className="sc-appsw__note">
        Si Alt+Tab salió de la página, usá el botón de arriba.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Document Editor (Ctrl+S save, Ctrl+Y redo)                 */
/* ------------------------------------------------------------------ */
function VirtualDocEditor({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [saved, setSaved] = useState(false);
  const [history] = useState(["Hola mundo", "Hola, ¡mundo!"]);
  const [histIdx, setHistIdx] = useState(1);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "s") { setSaved(true); window.setTimeout(() => setSaved(false), 1200); onAction(); }
    else if (k === "y") { setHistIdx((i) => Math.min(history.length - 1, i + 1)); onAction(); }
    else onAction();
  }

  return (
    <div className="sc-venv sc-doc">
      <div className="sc-doc__editor">
        <div className="sc-doc__toolbar">
          <span>Archivo</span>
          <span>Editar</span>
          <span>Vista</span>
          {saved && <span className="sc-doc__saved">✓ Guardado</span>}
        </div>
        <div className="sc-doc__body">{history[histIdx]}</div>
      </div>
      <button type="button" className={`sc-venv-btn ${saved ? "is-active" : ""}`} onClick={act}>
        {combo.key.toLowerCase() === "s" ? "Guardar documento" : "Rehacer cambio"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Dialog (Enter / Escape)                                     */
/* ------------------------------------------------------------------ */
function VirtualDialog({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [state, setState] = useState<"idle" | "open" | "done">("open");
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed || state === "done") return;
    const k = combo.key.toLowerCase();
    if (k === "enter") { setState("done"); onAction(); }
    else if (k === "escape") { setState("idle"); onAction(); }
    else onAction();
  }

  return (
    <div className="sc-venv sc-dialog">
      <div className="sc-dialog__app">
        <p>Una app quiere guardar los cambios.</p>
        {state === "open" && (
          <div className="sc-dialog__modal">
            <p className="sc-dialog__question">¿Guardar antes de salir?</p>
            <div className="sc-dialog__btns">
              <button type="button" className="sc-dialog__ok" onClick={() => { setState("done"); if (!completed) onAction(); }}>
                Aceptar (Enter)
              </button>
              <button type="button" className="sc-dialog__cancel" onClick={() => { setState("idle"); if (!completed) onAction(); }}>
                Cancelar (Escape)
              </button>
            </div>
          </div>
        )}
        {state === "done" && <p className="sc-dialog__result">✓ ¡Aceptado!</p>}
        {state === "idle" && <p className="sc-dialog__result">✗ Cancelado.</p>}
      </div>
      {state !== "open" && (
        <button type="button" className="sc-venv-btn is-active" onClick={() => setState("open")}>
          Abrir diálogo otra vez
        </button>
      )}
      <button type="button" className="sc-venv-btn" onClick={act} style={{ marginTop: "0.5rem" }}>
        {combo.key.toLowerCase() === "enter" ? "Aceptar (Enter)" : "Cancelar (Escape)"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Text Editor (Ctrl+C/V/A/Z)                                  */
/* ------------------------------------------------------------------ */
const SOURCE_TEXT = "¡Hola! Soy un texto para copiar.";

function VirtualTextEditor({ combo, completed, triggerSignal, onAction }: EnvProps) {
  /* Selection is SIMULATED with internal state — we never touch the real DOM
     selection, so Ctrl+A can never select the whole page. The source starts
     UNSELECTED; only performing Ctrl+A (keyboard, keycaps or button) selects
     it inside the box. */
  const [selectedAll, setSelectedAll] = useState(false);
  const [clipboard, setClipboard] = useState("");
  const [pasted, setPasted] = useState("");
  const [undone, setUndone] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "a") {
      setSelectedAll(true);            // visual select inside the simulator only
      onAction();
    } else if (k === "c") {
      // Copy the (simulated) selected text into internal game clipboard.
      setSelectedAll(true);
      setClipboard(SOURCE_TEXT);
      onAction();
    } else if (k === "v") {
      setPasted(clipboard || SOURCE_TEXT);
      onAction();
    } else if (k === "z") {
      setPasted("");
      setUndone(true);
      window.setTimeout(() => setUndone(false), 1200);
      onAction();
    } else {
      onAction();
    }
  }

  const label =
    combo.key.toLowerCase() === "a" ? "Seleccionar todo" :
    combo.key.toLowerCase() === "c" ? "Copiar" :
    combo.key.toLowerCase() === "v" ? "Pegar" :
    "Deshacer";

  return (
    <div className="sc-venv sc-texteditor">
      <div className="sc-texteditor__source">
        <span className="sc-texteditor__label">Texto fuente</span>
        {/* user-select:none in CSS keeps the browser from ever selecting it;
            the .is-selected class draws the simulated selection highlight. */}
        <p className={`sc-texteditor__text ${selectedAll ? "is-selected" : ""}`}>
          {SOURCE_TEXT}
        </p>
      </div>
      <div className="sc-texteditor__dest">
        <span className="sc-texteditor__label">Área de trabajo</span>
        <div className="sc-texteditor__area" aria-label="Área de trabajo">
          {pasted ? pasted : <span className="sc-texteditor__placeholder">Acá aparecerá lo que pegues…</span>}
        </div>
        {undone && <span className="sc-texteditor__undo">↩ deshecho</span>}
      </div>
      <button type="button" className="sc-venv-btn" onClick={act}>
        {label}
      </button>
    </div>
  );
}
