import { ArrowRight, RotateCcw, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getActivityById } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { markLevelComplete } from "../utils/progress";
import { SkillLevelView } from "./SkillLevelView";
import { ShortcutLevelView } from "./ShortcutLevelView";

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

function expectedKeysForActivity(character: string, activity: ReturnType<typeof getActivityById>): string[] {
  const keys = expectedKeysFor(character);
  const teachesShift = activity.requiresShift || activity.worldId === "island3" || activity.worldId === "island4";
  if (teachesShift) return keys;
  return keys.filter((key) => key !== "Shift");
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

function objectivePrompt(activity: ReturnType<typeof getActivityById>, target: string): string {
  if (!target) return "Prepará tus dedos.";
  if (activity.inputType === "letter") return `Tocá la letra ${target.toUpperCase()}.`;
  if (activity.inputType === "symbol") return `Escribí el símbolo ${target}.`;
  return `Escribí "${target}".`;
}

function keyLocationHint(character: string): string {
  const cap = keyCapFor(character);
  if (!cap) return "";
  const row = keyboardRows.find((item) => item.keys.includes(cap));
  const rowLabels: Record<string, string> = {
    num: "fila de números",
    top: "fila de arriba",
    home: "fila central",
    bot: "fila de abajo",
    mod: "teclas grandes",
  };
  return row ? `Buscá ${cap === "Space" ? "Espacio" : `la tecla ${cap}`} en la ${rowLabels[row.tone]}.` : "";
}

function playErrorSound() {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(180, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(110, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.14);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.15);
  window.setTimeout(() => void context.close(), 220);
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
  /* Keyboard-shortcut levels (comandos, ventanas/pestañas, atajos) use the
     generic shortcut engine. Like skill levels, return before keyboard state. */
  if (activity.inputType === "shortcut") {
    return <ShortcutLevelView activity={activity} />;
  }
  const [targetIndex, setTargetIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [feedback, setFeedback] = useState(() => objectivePrompt(activity, activity.targets[0] ?? ""));
  const [lastKey, setLastKey] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isErrorActive, setIsErrorActive] = useState(false);
  const [isIdleHintActive, setIsIdleHintActive] = useState(false);
  const [inputSignal, setInputSignal] = useState(0);
  const completionSaved = useRef(false);
  const activityRef = useRef(activity);
  const advanceTimeoutRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
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
    isAdvancing: false,
  });

  activityRef.current = activity;

  const totalObjectives = Math.max(1, activity.targets.length);
  const currentTargetIndex = Math.min(targetIndex, totalObjectives - 1);
  const target = activity.targets[currentTargetIndex] ?? "";
  const visibleObjective = isCompleted ? totalObjectives : Math.min(currentTargetIndex + 1, totalObjectives);

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
    return new Set(expectedKeysForActivity(expectedChar, activity));
  }, [activity, expectedChar]);

  const locationHint = keyLocationHint(expectedChar);
  const commaHint = target.includes(",");

  const accuracy = attempts === 0 ? 100 : Math.max(0, Math.round(((attempts - errors) / attempts) * 100));

  /* Keep the ref in sync with React state so the imperative input handlers
     below always read the latest values. */
  useEffect(() => {
    stateRef.current.targetIndex = currentTargetIndex;
    stateRef.current.typed = typed;
    stateRef.current.isCompleted = isCompleted;
    stateRef.current.attempts = attempts;
    stateRef.current.errors = errors;
  }, [currentTargetIndex, typed, isCompleted, attempts, errors]);

  function persistCompletion(finalAccuracy: number, finalAttempts: number) {
    if (completionSaved.current) return;
    completionSaved.current = true;
    const currentActivity = activityRef.current;
    markLevelComplete(currentActivity.worldId, currentActivity.levelNumber, finalAccuracy, finalAttempts);
  }

  function targetAt(index: number) {
    const targets = activityRef.current.targets;
    const lastIndex = Math.max(0, targets.length - 1);
    return targets[Math.min(index, lastIndex)] ?? "";
  }

  function completeLevel() {
    if (stateRef.current.isCompleted) return;
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    const currentActivity = activityRef.current;
    const lastIndex = Math.max(0, currentActivity.targets.length - 1);
    const finalAttempts = stateRef.current.attempts;
    const finalErrors = stateRef.current.errors;
    const finalAccuracy = finalAttempts === 0
      ? 100
      : Math.max(0, Math.round(((finalAttempts - finalErrors) / finalAttempts) * 100));

    stateRef.current.targetIndex = lastIndex;
    stateRef.current.isCompleted = true;
    stateRef.current.isAdvancing = false;
    setTargetIndex(lastIndex);
    persistCompletion(finalAccuracy, finalAttempts);
    setIsCompleted(true);
    setFeedback("¡Nivel completado! Ganaste estrellas.");
  }

  function advance() {
    if (stateRef.current.isCompleted) return;
    const currentActivity = activityRef.current;
    const lastIndex = Math.max(0, currentActivity.targets.length - 1);
    const nextIndex = stateRef.current.targetIndex + 1;

    if (nextIndex > lastIndex) {
      completeLevel();
      return;
    }

    stateRef.current.targetIndex = nextIndex;
    stateRef.current.typed = "";
    stateRef.current.isAdvancing = false;
    setTargetIndex(nextIndex);
    setTyped("");
    setFeedback(objectivePrompt(currentActivity, targetAt(nextIndex)));
  }

  function recordAttempt(isError: boolean) {
    const nextAttempts = stateRef.current.attempts + 1;
    const nextErrors = stateRef.current.errors + (isError ? 1 : 0);
    stateRef.current.attempts = nextAttempts;
    stateRef.current.errors = nextErrors;
    setAttempts(nextAttempts);
    setErrors(nextErrors);
  }

  function showMistake(message: string) {
    setFeedback(message);
    setIsIdleHintActive(false);
    setIsErrorActive(true);
    playErrorSound();
    if (errorTimeoutRef.current !== null) window.clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = window.setTimeout(() => {
      setIsErrorActive(false);
      errorTimeoutRef.current = null;
    }, 520);
  }

  useEffect(() => {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    stateRef.current = {
      targetIndex: 0,
      typed: "",
      isCompleted: false,
      attempts: 0,
      errors: 0,
      isAdvancing: false,
    };
    setTargetIndex(0);
    setTyped("");
    setAttempts(0);
    setErrors(0);
    setFeedback(objectivePrompt(activity, activity.targets[0] ?? ""));
    setIsCompleted(false);
    setIsErrorActive(false);
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
    completionSaved.current = false;
    return () => {
      if (advanceTimeoutRef.current !== null) {
        window.clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = null;
      }
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [activity.id]);

  useEffect(() => {
    if (isCompleted || !expectedChar) {
      setIsIdleHintActive(false);
      return;
    }

    setIsIdleHintActive(false);
    const show = window.setTimeout(() => setIsIdleHintActive(true), 4500);
    const hide = window.setTimeout(() => setIsIdleHintActive(false), 6400);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [currentTargetIndex, expectedChar, inputSignal, isCompleted, typed]);

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
    if (stateRef.current.isAdvancing) return;
    if (!character || character.length === 0) return;
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);

    if (character === " ") setLastKey("Space");
    else setLastKey(keyCapFor(character));

    const currentActivity = activityRef.current;
    const currentTarget = targetAt(stateRef.current.targetIndex);

    if (currentActivity.inputType === "letter") {
      const isCorrect = character.toUpperCase() === currentTarget.toUpperCase();
      recordAttempt(!isCorrect);
      if (isCorrect) {
        advance();
      } else {
        showMistake(`Buscá la tecla ${currentTarget.toUpperCase()}.`);
      }
      return;
    }

    if (currentActivity.inputType === "symbol") {
      const isCorrect = character === currentTarget;
      recordAttempt(!isCorrect);
      if (isCorrect) advance();
      else {
        showMistake(`Escribí el símbolo ${currentTarget}.`);
      }
      return;
    }

    const currentTyped = stateRef.current.typed;
    const nextTyped = currentTyped + character;

    const targetSoFar = currentTarget.slice(0, nextTyped.length);
    const matches = nextTyped === targetSoFar;
    const matchesLoose =
      !matches &&
      nextTyped.toLowerCase() === targetSoFar.toLowerCase() &&
      stripAccents(nextTyped.toLowerCase()) === stripAccents(targetSoFar.toLowerCase());

    if (!matches && !matchesLoose) {
      recordAttempt(true);
      if (currentActivity.inputType === "correction") {
        showMistake("Usá Backspace para corregir.");
        stateRef.current.typed = nextTyped;
        setTyped(nextTyped);
      } else {
        showMistake(`Esperaba "${targetSoFar}". Intentá de nuevo.`);
      }
      return;
    }

    recordAttempt(false);
    stateRef.current.typed = nextTyped;
    setTyped(nextTyped);
    if (nextTyped === currentTarget) {
      setFeedback("¡Excelente!");
      stateRef.current.isAdvancing = true;
      if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = window.setTimeout(() => {
        advanceTimeoutRef.current = null;
        advance();
      }, 350);
    } else if (matchesLoose && !matches) {
      setFeedback("Ojo con la tilde o la mayúscula. Seguí.");
    } else {
      setFeedback("Vas muy bien.");
    }
  }

  function processBackspace() {
    if (stateRef.current.isCompleted) return;
    if (stateRef.current.isAdvancing) return;
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
    setLastKey("Backspace");
    const currentActivity = activityRef.current;
    if (currentActivity.inputType === "letter" || currentActivity.inputType === "symbol") return;
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
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    stateRef.current = {
      targetIndex: 0,
      typed: "",
      isCompleted: false,
      attempts: 0,
      errors: 0,
      isAdvancing: false,
    };
    setTargetIndex(0);
    setTyped("");
    setAttempts(0);
    setErrors(0);
    setFeedback(objectivePrompt(activityRef.current, activityRef.current.targets[0] ?? ""));
    setIsCompleted(false);
    setIsErrorActive(false);
    setIsIdleHintActive(false);
    setInputSignal((value) => value + 1);
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
    <main className={`gameplay-page gameplay-shell page-fade ${isErrorActive ? "is-error" : ""} ${isIdleHintActive ? "is-idle-hint" : ""}`} style={{ backgroundImage: `url("${getGameplayBackground(activity.worldId)}")` }}>
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
          const isLongTarget = target.length > 14 || target.includes("@");
          return (
            <>
              <div className={`target-card target--${variant} ${isLongTarget ? "target--long" : ""} ${isErrorActive ? "is-error" : ""} ${isIdleHintActive ? "is-idle-hint" : ""}`}>
                <span>Objetivo {visibleObjective} / {totalObjectives}</span>
                <strong>{target}</strong>
                {locationHint && !isCompleted && (
                  <small className="key-location-hint">{locationHint}</small>
                )}
                {commaHint && !isCompleted && (
                  <small className="comma-hint">Después de una coma va un espacio antes de la siguiente palabra.</small>
                )}
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
          <span>Errores: {errors}</span>
          <span>Precisión: {accuracy}%</span>
        </div>
      </section>

      {/* Two motivational robots flank the keyboard, switching phrases each target. */}
      {!isCompleted && (() => {
        const errored = isErrorActive || (errors > 0 && attempts > 0 && (attempts - errors) / attempts < 0.6);
        const phrasePool = errored ? ERROR_PHRASES : MOTIVATION_PHRASES;
        const leftPhrase = isIdleHintActive && locationHint ? locationHint : phrasePool[targetIndex % phrasePool.length];
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
              const isTarget = !isCompleted && expectedKeys.has(key);
              const isCombo = isTarget && expectedKeys.size > 1;
              const isFindHint = isTarget && isIdleHintActive;
              const isPressed = lastKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`key key--${row.tone} ${key === "Space" ? "key--space" : ""} ${key === "Backspace" || key === "Shift" || key === "Enter" ? "key--wide" : ""} ${isTarget ? "is-target" : ""} ${isCombo ? "is-target-combo" : ""} ${isFindHint ? "is-find-hint" : ""} ${isPressed ? "is-pressed" : ""}`}
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
            <p>Sumaste {accuracy}% de precisión.</p>
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
