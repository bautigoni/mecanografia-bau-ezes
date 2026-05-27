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
  "@":  ["Shift", "2"],
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isCompleted) return;

      const key = event.key;

      if (key === "Shift" || key === "CapsLock" || key === "Dead") return;

      if (key === "Backspace") {
        event.preventDefault();
        setLastKey("Backspace");
        if (activity.inputType === "letter" || activity.inputType === "symbol") return;
        setTyped((value) => value.slice(0, -1));
        return;
      }

      if (key === "Enter") return;

      if (key === " ") {
        setLastKey("Space");
      } else if (key.length === 1) {
        setLastKey(keyCapFor(key));
      } else {
        return;
      }

      const character = key;
      if (character.length !== 1) return;

      if (activity.inputType === "letter") {
        event.preventDefault();
        setAttempts((value) => value + 1);
        if (character.toUpperCase() === target.toUpperCase()) {
          advance();
        } else {
          setErrors((value) => value + 1);
          setFeedback(`Buscá la tecla ${target.toUpperCase()}.`);
        }
        return;
      }

      if (activity.inputType === "symbol") {
        event.preventDefault();
        setAttempts((value) => value + 1);
        if (character === target) {
          advance();
        } else {
          setErrors((value) => value + 1);
          setFeedback(`Escribí el símbolo ${target}.`);
        }
        return;
      }

      event.preventDefault();
      const nextTyped = typed + character;
      setAttempts((value) => value + 1);

      const targetSoFar = target.slice(0, nextTyped.length);
      const matches = nextTyped === targetSoFar;
      const matchesLoose =
        !matches &&
        nextTyped.toLowerCase() === targetSoFar.toLowerCase() &&
        stripAccents(nextTyped.toLowerCase()) === stripAccents(targetSoFar.toLowerCase());

      if (!matches && !matchesLoose) {
        setErrors((value) => value + 1);
        if (activity.inputType === "correction") {
          setFeedback("Usá Backspace para corregir.");
          setTyped(nextTyped);
        } else {
          setFeedback(`Esperaba "${targetSoFar}". Intentá de nuevo.`);
        }
        return;
      }

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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activity.inputType, target, typed, isCompleted, attempts, errors, isLastTarget]);

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
              <img src={assets.mascotFemaleWave} alt="" />
            </figure>
            <figure className="game-mascot game-mascot--right">
              <div className={`game-mascot__bubble ${errored ? "is-warn" : ""}`}>{rightPhrase}</div>
              <img src={assets.mascotMaleJump} alt="" />
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
