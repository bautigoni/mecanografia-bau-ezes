import { ArrowRight, RotateCcw, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getActivityById } from "../data/activities";
import { assets } from "../utils/assets";
import { markLevelComplete } from "../utils/progress";

type KeyboardRow = { id: string; tone: "num" | "top" | "home" | "bot" | "mod"; keys: string[] };

const keyboardRows: KeyboardRow[] = [
  { id: "num",  tone: "num",  keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
  { id: "top",  tone: "top",  keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"] },
  { id: "home", tone: "home", keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"] },
  { id: "bot",  tone: "bot",  keys: ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "Backspace"] },
  { id: "mod",  tone: "mod",  keys: ["Shift", "Space", "Enter"] },
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function keyCapFor(character: string): string {
  if (character === " ") return "Space";
  const upper = character.toUpperCase();
  const plain = stripAccents(upper);
  if ("¿¡".includes(character) || "?!@:;-_".includes(character)) {
    return "Shift";
  }
  return plain;
}

/* Shift combos shown on World 4 — covers Latin-American Spanish layout where
   useful, but is mapped here per character regardless of physical layout so
   kids see *what* the symbol "is made of" even on a US/Mac keyboard. */
const SHIFT_COMBOS: Record<string, string[]> = {
  "!":  ["Shift", "1"],
  "?":  ["Shift", "/"],
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
  "¿":  ["Shift", "¡"],
  "¡":  ["Shift", "¿"],
  '"':  ["Shift", "'"],
  "<":  ["Shift", ","],
  ">":  ["Shift", "."],
};

function comboFor(character: string): string[] | null {
  if (!character) return null;
  if (SHIFT_COMBOS[character]) return SHIFT_COMBOS[character];
  // Uppercase letters always need Shift + the lowercase letter.
  if (/^[A-ZÑÁÉÍÓÚÜ]$/.test(character)) {
    const lower = character.toLowerCase();
    return ["Shift", stripAccents(lower).toUpperCase()];
  }
  return null;
}

export function GameplayPage() {
  const { activityId } = useParams();
  const activity = getActivityById(activityId);
  const navigate = useNavigate();
  const [targetIndex, setTargetIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState("Prepará tus dedos.");
  const [lastKey, setLastKey] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const completionSaved = useRef(false);

  const target = activity.targets[targetIndex];
  const isLastTarget = targetIndex === activity.targets.length - 1;

  const expectedChar = useMemo(() => {
    if (activity.inputType === "letter" || activity.inputType === "symbol") {
      return target;
    }
    return target[typed.length] ?? "";
  }, [activity.inputType, target, typed]);

  const expectedKey = useMemo(() => {
    if (!expectedChar) return "";
    return keyCapFor(expectedChar);
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
          const showCombo = activity.worldId === "island4" || activity.requiresShift;
          const combo = showCombo ? comboFor(expectedChar) : null;
          const showTypedPreview =
            activity.inputType !== "letter" && activity.inputType !== "symbol";
          return (
            <>
              <div className={`target-card target--${variant}`}>
                <span>Objetivo {targetIndex + 1} / {activity.targets.length}</span>
                <strong>{target}</strong>
                {combo && !isCompleted && (
                  <div className="combo-hint" aria-label={`Tecla combinada: ${combo.join(" + ")}`}>
                    <span>Para escribir {expectedChar || "este símbolo"}</span>
                    <kbd>{combo[0]}</kbd>
                    <span className="combo-hint__plus">+</span>
                    <kbd>{combo[1]}</kbd>
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
                  <span className={`typed-preview__value ${typed ? "" : "is-empty"}`}>
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

      <section className="visual-keyboard" aria-label="Teclado visual">
        {keyboardRows.map((row) => (
          <div className={`keyboard-row keyboard-row--${row.tone}`} key={row.id}>
            {row.keys.map((key) => {
              const isTarget = activity.mode === "assisted" && !isCompleted && expectedKey === key;
              const isPressed = lastKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`key key--${row.tone} ${key === "Space" ? "key--space" : ""} ${key === "Backspace" || key === "Shift" || key === "Enter" ? "key--wide" : ""} ${isTarget ? "is-target" : ""} ${isPressed ? "is-pressed" : ""}`}
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
