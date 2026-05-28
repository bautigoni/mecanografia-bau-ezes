import { ArrowRight, RotateCcw, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getActivityById } from "../data/activities";
import { assets } from "../utils/assets";
import { markLevelComplete } from "../utils/progress";
import { SkillLevelView } from "./SkillLevelView";

const MOTIVATION_PHRASES = [
  "¡Vamos que podés!",
  "Probá despacio.",
  "Respirá y seguí.",
  "Buen ritmo 👏",
  "Sos un crack.",
  "¡Increíble, así se hace!",
  "Una más y la sacás.",
  "Practicar es ganar.",
];

const ERROR_PHRASES = [
  "Tranqui, intentá de nuevo.",
  "Todos nos equivocamos.",
  "Mirá la tecla y volvelo a intentar.",
  "¡Casi! Otra vez.",
];

type KeyboardRow = { id: string; tone: "num" | "top" | "home" | "bot" | "mod"; keys: string[] };

const keyboardRows: KeyboardRow[] = [
  { id: "num",  tone: "num",  keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "'", "¿"] },
  { id: "top",  tone: "top",  keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"] },
  { id: "home", tone: "home", keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"] },
  { id: "bot",  tone: "bot",  keys: ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "-", "Backspace"] },
  { id: "mod",  tone: "mod",  keys: ["Shift", "Space", "Enter"] },
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* Accented vowels: on a Spanish keyboard you press the dead key ´ then the
   vowel; on an English/US keyboard the OS gives you the same letter via
   Option/AltGr + the vowel. We show ´ + a as the universal hint — the kid
   recognises "the tilde mark, then the letter". */
const ACCENT_MAP: Record<string, string> = {
  "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u",
  "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U",
};

/* Shift combinations on a Latin-American Spanish keyboard.
   Keys on the right of the table reference the *cap labels* used by the
   visual keyboard above, so highlighting works without any extra mapping. */
const SHIFT_COMBOS: Record<string, string[]> = {
  "!":  ["Shift", "1"],
  "?":  ["Shift", "'"],   // ES-LA: ? lives on the ' key
  /* @ is special: on ES-LA keyboards it is AltGr + Q (or AltGr + 2 on ES-ES).
     We surface AltGr + Q as the primary combo and light up the Q cap. The
     `comboFor()` helper adds the playful "o también Shift + 2" hint. */
  "@":  ["AltGr", "Q"],
  "#":  ["Shift", "3"],
  "$":  ["Shift", "4"],
  "%":  ["Shift", "5"],
  "&":  ["Shift", "7"],
  "*":  ["Shift", "8"],
  "(":  ["Shift", "9"],
  ")":  ["Shift", "0"],
  "_":  ["Shift", "-"],
  "+":  ["Shift", "="],
  ":":  ["Shift", "."],
  ";":  ["Shift", ","],
  "¡":  ["Shift", "¿"],   // ¡ is Shift on the ¿ cap
  '"':  ["Shift", "'"],
  "<":  ["Shift", ","],
  ">":  ["Shift", "."],
};

/* Friendly alternate ways to type the same symbol — purely informational,
   rendered as a secondary hint below the primary combo. */
const SECONDARY_COMBOS: Record<string, string[][]> = {
  "@": [["Shift", "2"], ["AltGr", "2"]],
};

/* Maps a character → the cap printed on our visual keyboard. */
function keyCapFor(character: string): string {
  if (!character) return "";
  if (character === " ") return "Space";
  // Accented vowels & ñ render on the keyboard as the *base* letter.
  if (ACCENT_MAP[character]) return ACCENT_MAP[character].toUpperCase();
  if (/^[a-zA-Z]$/.test(character)) return character.toUpperCase();
  if (character === "ñ" || character === "Ñ") return "Ñ";
  return character; // digits, punctuation, ¿, ', etc. render as-is.
}

/* Returns the set of keyboard caps to highlight for a given target char.
   - lowercase letter / digit / punctuation that exists on the keyboard → 1 key
   - Shift combo                                                       → 2 keys
   - uppercase letter                                                   → 2 keys (Shift + LETTER)
   - accented vowel                                                     → 1 key (base letter)
   - uppercase accented vowel                                           → 2 keys (Shift + LETTER)
*/
function expectedKeysFor(character: string): string[] {
  if (!character) return [];
  if (SHIFT_COMBOS[character]) return SHIFT_COMBOS[character];

  // Accented vowel
  if (ACCENT_MAP[character]) {
    const base = ACCENT_MAP[character];
    if (/[A-Z]/.test(base)) return ["Shift", base];
    return [base.toUpperCase()];
  }

  // Plain uppercase letter (a-z or Ñ)
  if (/^[A-ZÑ]$/.test(character)) return ["Shift", character];

  return [keyCapFor(character)];
}

function comboFor(character: string): string[] | null {
  if (!character) return null;
  if (SHIFT_COMBOS[character]) return SHIFT_COMBOS[character];

  // Accented vowels — show the dead-key combo (´ + vowel). Uppercase accented
  // letters also need Shift, so we surface a 3-step hint.
  if (ACCENT_MAP[character]) {
    const base = ACCENT_MAP[character];
    if (base === base.toUpperCase() && /[A-Z]/.test(base)) {
      return ["´", "Shift", base.toLowerCase().toUpperCase()];
    }
    return ["´", base];
  }

  // Plain uppercase letters always need Shift + the lowercase letter.
  if (/^[A-ZÑ]$/.test(character)) {
    const lower = character.toLowerCase();
    return ["Shift", lower.toUpperCase()];
  }
  return null;
}

export function GameplayPage() {
  const { activityId } = useParams();
  const activity = getActivityById(activityId);
  const navigate = useNavigate();

  /* Digital-skill levels (island 5) use a dedicated mini-shell rather than
     the typing keyboard pipeline. We early-return before any keyboard
     state is set up so the two modes stay cleanly isolated. */
  if (activity.inputType === "skill") {
    return <SkillLevelView activity={activity} />;
  }
  const [targetIndex, setTargetIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState("Prepará tus dedos.");
  const [lastKey, setLastKey] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const completionSaved = useRef(false);
  const typedScrollRef = useRef<HTMLSpanElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  /* Latest state lives in refs so the beforeinput handler can read up-to-date
     values without being torn down/rebuilt on every keystroke (which loses
     focus on some Android browsers). */
  const stateRef = useRef({
    targetIndex: 0,
    typed: "",
    isCompleted: false,
    attempts: 0,
    errors: 0,
  });

  const target = activity.targets[targetIndex];
  const isLastTarget = targetIndex === activity.targets.length - 1;

  const expectedChar = useMemo(() => {
    if (activity.inputType === "letter" || activity.inputType === "symbol") {
      return target;
    }
    return target[typed.length] ?? "";
  }, [activity.inputType, target, typed]);

  /* Every keyboard cap that should glow for the current character.
     Multi-key combos (Shift + 1, Shift + ¿) light up *both* caps. */
  const expectedKeys = useMemo(() => {
    if (!expectedChar) return new Set<string>();
    return new Set(expectedKeysFor(expectedChar));
  }, [expectedChar]);

  const accuracy = attempts === 0 ? 100 : Math.max(0, Math.round(((attempts - errors) / attempts) * 100));

  /* Keep the ref in sync with React state so the imperative input handlers
     below always read the latest values. */
  useEffect(() => {
    stateRef.current = { targetIndex, typed, isCompleted, attempts, errors };
  }, [targetIndex, typed, isCompleted, attempts, errors]);

  function persistCompletion(finalAccuracy: number, finalAttempts: number) {
    if (completionSaved.current) return;
    completionSaved.current = true;
    markLevelComplete(activity.worldId, activity.levelNumber, finalAccuracy, finalAttempts);
  }

  function advance() {
    if (isLastTarget) {
      const finalAttempts = attempts;
      const finalAccuracy = finalAttempts === 0 ? 100 : Math.max(0, Math.round(((finalAttempts - errors) / finalAttempts) * 100));
      persistCompletion(finalAccuracy, finalAttempts);
      setIsCompleted(true);
      setFeedback("¡Nivel completado! Ganaste estrellas.");
      return;
    }
    setTargetIndex((value) => value + 1);
    setTyped("");
    setFeedback("¡Muy bien! Seguimos.");
  }

  useEffect(() => {
    setTargetIndex(0);
    setTyped("");
    setAttempts(0);
    setErrors(0);
    setFeedback("Prepará tus dedos.");
    setIsCompleted(false);
    completionSaved.current = false;
  }, [activity.id]);

  /* Keep the typed-preview pinned to the most recent character so long inputs
     stay legible without wrapping to a new line. */
  useEffect(() => {
    const node = typedScrollRef.current;
    if (node) node.scrollLeft = node.scrollWidth;
  }, [typed]);

  /* Process one logical character (with accent, ñ, mayúscula already
     composed by the OS). Reused by both the physical-keyboard fallback and
     the beforeinput / composition pipeline used by touch keyboards. */
  function processCharacter(character: string) {
    if (stateRef.current.isCompleted) return;
    if (!character || character.length === 0) return;

    if (character === " ") setLastKey("Space");
    else setLastKey(keyCapFor(character));

    if (activity.inputType === "letter") {
      setAttempts((v) => v + 1);
      if (character.toUpperCase() === target.toUpperCase()) {
        advance();
      } else {
        setErrors((v) => v + 1);
        setFeedback(`Buscá la tecla ${target.toUpperCase()}.`);
      }
      return;
    }

    if (activity.inputType === "symbol") {
      setAttempts((v) => v + 1);
      if (character === target) advance();
      else {
        setErrors((v) => v + 1);
        setFeedback(`Escribí el símbolo ${target}.`);
      }
      return;
    }

    const currentTyped = stateRef.current.typed;
    const nextTyped = currentTyped + character;
    setAttempts((v) => v + 1);

    const targetSoFar = target.slice(0, nextTyped.length);
    const matches = nextTyped === targetSoFar;
    const matchesLoose =
      !matches &&
      nextTyped.toLowerCase() === targetSoFar.toLowerCase() &&
      stripAccents(nextTyped.toLowerCase()) === stripAccents(targetSoFar.toLowerCase());

    if (!matches && !matchesLoose) {
      setErrors((v) => v + 1);
      if (activity.inputType === "correction") {
        setFeedback("Usá Backspace para corregir.");
        stateRef.current.typed = nextTyped;
        setTyped(nextTyped);
      } else {
        setFeedback(`Esperaba "${targetSoFar}". Intentá de nuevo.`);
      }
      return;
    }

    stateRef.current.typed = nextTyped;
    setTyped(nextTyped);
    if (nextTyped === target) {
      setFeedback("¡Excelente!");
      window.setTimeout(() => advance(), 350);
    } else if (matchesLoose && !matches) {
      setFeedback("Ojo con la tilde o la mayúscula. Seguí.");
    } else {
      setFeedback("Vas muy bien.");
    }
  }

  function processBackspace() {
    if (stateRef.current.isCompleted) return;
    setLastKey("Backspace");
    if (activity.inputType === "letter" || activity.inputType === "symbol") return;
    const next = stateRef.current.typed.slice(0, -1);
    stateRef.current.typed = next;
    setTyped(next);
  }

  /* ------------------------------------------------------------------ */
  /* Input pipeline                                                     */
  /* A hidden <input> stays focused so:                                  */
  /*   - mobile / Chrome touch devices can pop up the OS keyboard,       */
  /*   - dead keys (´ + a → á) and IME-composed text come through        */
  /*     beforeinput / compositionend with the *final* character,        */
  /*   - AltGr combos (e.g. AltGr+Q → @ on ES-LA) are not blocked.       */
  /* On desktop the window-level keydown is still used as a fallback so  */
  /* keys arrive even if the hidden input briefly loses focus. */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const input = captureInputRef.current;
    if (!input) return;

    /* React's synthetic onBeforeInput is *not* a 1:1 alias for the native
       beforeinput event — it's a polyfilled compositionend on most engines.
       We attach the listener natively so dead keys + touch keyboards on
       real Chrome / Edge / Safari deliver composed characters reliably. */
    function onBeforeInput(this: HTMLInputElement, ev: Event) {
      const native = ev as InputEvent;
      const type = native.inputType;
      if (type === "deleteContentBackward" || type === "deleteContentForward" || type === "deleteByCut") {
        ev.preventDefault();
        processBackspace();
        input!.value = "";
        return;
      }
      if (type && type.startsWith("insert")) {
        const data = native.data ?? "";
        if (data && data !== "´" && data !== "`" && data !== "^" && data !== "~" && data !== "¨") {
          for (const ch of data) processCharacter(ch);
        }
        // Android browsers ignore preventDefault — clear next tick to be safe.
        window.setTimeout(() => { if (input) input.value = ""; }, 0);
        ev.preventDefault();
      }
    }
    function onCompositionEnd(this: HTMLInputElement, ev: CompositionEvent) {
      const data = ev.data ?? "";
      if (data) for (const ch of data) processCharacter(ch);
      window.setTimeout(() => { if (input) input.value = ""; }, 0);
    }

    function refocus() {
      window.setTimeout(() => {
        const a = document.activeElement;
        if (a && a.tagName === "BUTTON") return;
        if (a && a.tagName === "INPUT" && a !== input) return;
        input?.focus({ preventScroll: true });
      }, 0);
    }

    input.addEventListener("beforeinput", onBeforeInput as EventListener);
    input.addEventListener("compositionend", onCompositionEnd as EventListener);
    input.focus({ preventScroll: true });
    window.addEventListener("pointerdown", refocus);
    window.addEventListener("touchend", refocus);
    return () => {
      input.removeEventListener("beforeinput", onBeforeInput as EventListener);
      input.removeEventListener("compositionend", onCompositionEnd as EventListener);
      window.removeEventListener("pointerdown", refocus);
      window.removeEventListener("touchend", refocus);
    };
    // processCharacter / processBackspace are stable via stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Backspace is captured here so even when the input is empty it still
      // erases a typed character.
      if (event.key === "Backspace") {
        event.preventDefault();
        processBackspace();
        return;
      }
      // Visual press feedback for modifier keys (so the cap glows).
      if (event.key === "Shift") { setLastKey("Shift"); return; }
      if (event.key === "CapsLock" || event.key === "Dead" || event.key === "Process") return;

      // Fallback character pipeline.
      // If the hidden capture input lost focus (e.g. the user clicked a
      // button outside it), beforeinput will not fire and the level would
      // silently ignore keystrokes — including uppercase letters typed with
      // Shift. We process the printable character here and refocus the
      // capture input so subsequent strokes go through the IME pipeline
      // again. We skip when isComposing so accented characters arrive
      // through compositionend instead.
      const active = document.activeElement;
      const captureFocused = active === captureInputRef.current;

      if (!captureFocused && !event.isComposing && event.key.length === 1) {
        // AltGr (Ctrl+Alt) on Windows still produces a printable character —
        // accept it. Skip raw Ctrl/Meta shortcuts.
        const isAltGr = event.ctrlKey && event.altKey;
        if (!isAltGr && (event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        processCharacter(event.key);
        captureInputRef.current?.focus({ preventScroll: true });
        return;
      }

      // Space scroll guard when no input focused.
      if (event.key === " " && !captureFocused && !event.isComposing) {
        event.preventDefault();
        processCharacter(" ");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.inputType, target]);

  function retry() {
    setTargetIndex(0);
    setTyped("");
    setAttempts(0);
    setErrors(0);
    setFeedback("Prepará tus dedos.");
    setIsCompleted(false);
    completionSaved.current = false;
  }

  function listen() {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(activity.listenText);
      utterance.lang = "es-AR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setFeedback("Reproduciendo consigna.");
      return;
    }
    setFeedback(activity.listenText);
  }

  return (
    <main className="gameplay-page gameplay-shell page-fade" style={{ backgroundImage: `url("${assets.gameplayBg}")` }}>
      {/* Hidden capture field — drives beforeinput/composition so accented
          characters work on touch & Spanish-layout keyboards. */}
      <input
        ref={captureInputRef}
        className="gameplay-capture"
        type="text"
        defaultValue=""
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        lang="es"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => { e.currentTarget.value = ""; }}
        onBlur={(e) => {
          // If focus moved to a real interactive element (button/link) let it
          // keep focus. Otherwise re-grab so the keyboard stays available.
          const next = e.relatedTarget as HTMLElement | null;
          if (next && (next.tagName === "BUTTON" || next.tagName === "A")) return;
          window.setTimeout(() => captureInputRef.current?.focus({ preventScroll: true }), 30);
        }}
      />
      <button className="game-exit" type="button" onClick={() => navigate(`/worlds/${activity.worldId}`)}>
        <X size={20} />
        Salir
      </button>

      <section className="game-stage" aria-label={activity.title}>
        <div className="game-status">
          <span>Nivel {activity.levelNumber}</span>
          <strong>{activity.title}</strong>
          <em>{activity.subtitle}</em>
        </div>

        {(() => {
          const isPhrase = /\s/.test(target);
          const variant =
            activity.inputType === "letter" ? "letter" :
            activity.inputType === "symbol" ? "symbol" :
            isPhrase ? "phrase" :
            "word";
          const showCombo =
            activity.worldId === "island4" ||
            activity.worldId === "island3" ||
            activity.requiresShift ||
            activity.requiresAccent;
          const combo = showCombo ? comboFor(expectedChar) : null;
          const altCombos = showCombo && expectedChar ? SECONDARY_COMBOS[expectedChar] : undefined;
          const showTypedPreview =
            activity.inputType !== "letter" && activity.inputType !== "symbol";
          return (
            <>
              <div className={`target-card target--${variant}`}>
                <span>Objetivo {targetIndex + 1} / {activity.targets.length}</span>
                <strong>{target}</strong>
                {combo && !isCompleted && (
                  <div className="combo-hint" aria-label={`Combinación: ${combo.join(" + ")}`}>
                    <span>Para escribir {expectedChar || "este símbolo"}</span>
                    {combo.map((step, i) => (
                      <span key={`${step}-${i}`} className="combo-hint__step">
                        {i > 0 && <span className="combo-hint__plus">+</span>}
                        <kbd>{step}</kbd>
                      </span>
                    ))}
                  </div>
                )}
                {altCombos && !isCompleted && (
                  <div className="combo-hint combo-hint--alt" aria-label="Otras formas">
                    <span>o también</span>
                    {altCombos.map((alt, idx) => (
                      <span key={idx} className="combo-hint__alt">
                        {alt.map((step, i) => (
                          <span key={`${step}-${i}`} className="combo-hint__step">
                            {i > 0 && <span className="combo-hint__plus">+</span>}
                            <kbd>{step}</kbd>
                          </span>
                        ))}
                        {idx < altCombos.length - 1 && <span className="combo-hint__sep">·</span>}
                      </span>
                    ))}
                  </div>
                )}
                {(activity.requiresShift || activity.requiresAccent) && !isCompleted && (
                  <small style={{ display: "block", marginTop: 6, opacity: 0.75 }}>
                    {activity.requiresShift && "Usá Shift para mayúsculas y símbolos. "}
                    {activity.requiresAccent && "Respetá tildes y la ñ."}
                  </small>
                )}
              </div>

              {showTypedPreview && (
                <div className="typed-preview" aria-live="polite">
                  <span className="typed-preview__label">Lo que estás escribiendo</span>
                  <span
                    ref={typedScrollRef}
                    className={`typed-preview__value ${typed ? "" : "is-empty"}`}
                  >
                    {typed || "Empezá a escribir…"}
                    {typed && <span className="typed-preview__caret" aria-hidden="true" />}
                  </span>
                </div>
              )}
            </>
          );
        })()}

        <div className="game-metrics">
          <span>Intentos: {attempts}</span>
          <span>Errores: {errors}</span>
          <span>Precisión: {accuracy}%</span>
        </div>
      </section>

      {/* Two motivational robots flank the keyboard, switching phrases each target. */}
      {!isCompleted && (() => {
        const errored = errors > 0 && attempts > 0 && (attempts - errors) / attempts < 0.6;
        const phrasePool = errored ? ERROR_PHRASES : MOTIVATION_PHRASES;
        const leftPhrase = phrasePool[targetIndex % phrasePool.length];
        const rightPhrase = phrasePool[(targetIndex + Math.max(1, Math.floor(phrasePool.length / 2))) % phrasePool.length];
        return (
          <div className="game-mascots" aria-hidden="true">
            <figure className="game-mascot game-mascot--left">
              <div className={`game-mascot__bubble ${errored ? "is-warn" : ""}`}>{leftPhrase}</div>
              <img src={assets.mascotFemaleWave} alt="" decoding="async" />
            </figure>
            <figure className="game-mascot game-mascot--right">
              <div className={`game-mascot__bubble ${errored ? "is-warn" : ""}`}>{rightPhrase}</div>
              <img src={assets.mascotMaleJump} alt="" decoding="async" />
            </figure>
          </div>
        );
      })()}

      <section className="visual-keyboard" aria-label="Teclado visual">
        {keyboardRows.map((row) => (
          <div className={`keyboard-row keyboard-row--${row.tone}`} key={row.id}>
            {row.keys.map((key) => {
              const isTarget = activity.mode === "assisted" && !isCompleted && expectedKeys.has(key);
              const isCombo = isTarget && expectedKeys.size > 1;
              const isPressed = lastKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`key key--${row.tone} ${key === "Space" ? "key--space" : ""} ${key === "Backspace" || key === "Shift" || key === "Enter" ? "key--wide" : ""} ${isTarget ? "is-target" : ""} ${isCombo ? "is-target-combo" : ""} ${isPressed ? "is-pressed" : ""}`}
                  tabIndex={-1}
                >
                  {key === "Space" ? "Espacio" : key}
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <section className="instruction-panel" aria-live="polite">
        <div>
          <h1>{activity.instruction}</h1>
          <p>{feedback}</p>
        </div>
        <div className="instruction-actions">
          <button type="button" onClick={listen}>
            <Volume2 size={21} />
            Escuchar consigna
          </button>
          <button type="button" onClick={retry}>
            <RotateCcw size={20} />
            Reintentar
          </button>
        </div>
      </section>

      {isCompleted && (
        <div className="level-complete-overlay" role="dialog" aria-modal="true" aria-labelledby="level-complete-title">
          <div className="level-complete-card">
            <div className="level-complete-burst" aria-hidden="true">
              <span>★</span><span>✦</span><span>✧</span><span>★</span><span>✦</span><span>✧</span>
            </div>
            <div className="level-complete-trophy" aria-hidden="true">🏆</div>
            <h2 id="level-complete-title">¡Nivel completado!</h2>
            <p>Sumaste {accuracy}% de precisión en {attempts} intento{attempts === 1 ? "" : "s"}.</p>
            <div className="level-complete-stars" aria-hidden="true">
              {[1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`level-complete-star ${accuracy >= index * 33 ? "is-on" : ""}`}
                  style={{ animationDelay: `${0.18 + index * 0.18}s` }}
                >
                  ★
                </span>
              ))}
            </div>
            <div className="level-complete-actions">
              <button type="button" className="level-complete-action level-complete-action--ghost" onClick={retry}>
                <RotateCcw size={18} />
                Reintentar
              </button>
              <button
                type="button"
                className="level-complete-action level-complete-action--primary"
                onClick={() => navigate(`/worlds/${activity.worldId}`)}
              >
                <ArrowRight size={20} />
                Volver a la isla
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
