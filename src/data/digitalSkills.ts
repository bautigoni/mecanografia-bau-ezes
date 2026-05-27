/**
 * Digital-skills curriculum scaffold.
 *
 * The existing typing curriculum lives in `activities.ts` and is the
 * `category: "typing"` part of the product. This file adds the parallel
 * `category: "digitalSkills"` so future challenges (mouse, touchpad,
 * windows, tabs, shortcuts) plug into the same model without forking the
 * data shape.
 *
 * Nothing is wired into routes yet — this is intentionally a foundation
 * so the mini desktop/browser simulator can be built incrementally on top
 * of `SkillChallengeShell` (see `src/components/digitalSkills/`).
 */

export type SkillCategory = "typing" | "digitalSkills";

export type DigitalSkillType =
  | "leftClick"
  | "rightClick"
  | "doubleClick"
  | "dragAndDrop"
  | "scroll"
  | "touchpadScroll"
  | "windowOpen"
  | "windowClose"
  | "windowMinimize"
  | "windowMaximize"
  | "tabOpen"
  | "tabClose"
  | "tabSwitch"
  | "shortcut"
  | "selectText"
  | "copyPaste"
  | "uiSpotting";

export type Difficulty = "inicial" | "facil" | "media" | "dificil" | "experto";

/**
 * A single digital-skill challenge.
 *
 * `expectedAction` is a string id the simulator will evaluate against the
 * user's gesture. The simulator decides what counts as success — this file
 * only describes intent.
 */
export interface SkillChallenge {
  id: string;
  category: SkillCategory; // always "digitalSkills" for entries below
  challengeType: DigitalSkillType;
  instruction: string;
  goal: string;
  expectedAction: string;
  successFeedback: string;
  errorFeedback: string;
  difficulty: Difficulty;
  /** Same world ids the typing curriculum uses, so a single island can mix categories later. */
  world: "island1" | "island2" | "island3" | "island4" | "freestyle";
  level: number;
  /** Per-attempt telemetry slot — written by the runtime, not predeclared here. */
  metrics?: SkillMetrics;
  /** Optional payload used by the simulator to render scene state (icons, targets, scripts). */
  scene?: Record<string, unknown>;
}

export interface SkillMetrics {
  attempts: number;
  errors: number;
  timeMs: number;
  completed: boolean;
}

/* ------------------------------------------------------------------ */
/* Seed catalogue                                                     */
/* ------------------------------------------------------------------ */

export const digitalSkillsCatalog: SkillChallenge[] = [
  /* ---- Mouse ---- */
  {
    id: "ds-click-1",
    category: "digitalSkills",
    challengeType: "leftClick",
    instruction: "Hacé clic en el botón azul.",
    goal: "Aprender el clic izquierdo.",
    expectedAction: "click:primary:#target",
    successFeedback: "¡Bien hecho! Eso es un clic izquierdo.",
    errorFeedback: "Probá apuntar al botón y hacer un solo clic.",
    difficulty: "inicial",
    world: "freestyle",
    level: 1,
  },
  {
    id: "ds-click-2",
    category: "digitalSkills",
    challengeType: "rightClick",
    instruction: "Abrí el menú con clic derecho sobre el icono.",
    goal: "Usar el clic derecho para abrir menús.",
    expectedAction: "click:secondary:#target",
    successFeedback: "¡Genial! Apareció el menú contextual.",
    errorFeedback: "Acordate: el clic derecho es el otro botón del mouse.",
    difficulty: "facil",
    world: "freestyle",
    level: 2,
  },
  {
    id: "ds-click-3",
    category: "digitalSkills",
    challengeType: "doubleClick",
    instruction: "Hacé doble clic en la carpeta.",
    goal: "Diferenciar el clic simple del doble clic.",
    expectedAction: "click:double:#folder",
    successFeedback: "¡Abierta! Doble clic dominado.",
    errorFeedback: "Tienen que ser dos clics seguidos, rapiditos.",
    difficulty: "facil",
    world: "freestyle",
    level: 3,
  },
  {
    id: "ds-drag-1",
    category: "digitalSkills",
    challengeType: "dragAndDrop",
    instruction: "Arrastrá la estrella hasta la mochila.",
    goal: "Aprender a arrastrar y soltar.",
    expectedAction: "drag:#star:to:#backpack",
    successFeedback: "¡Guardada! Eso es arrastrar y soltar.",
    errorFeedback: "Hacé clic, mantené apretado y movela hasta la mochila.",
    difficulty: "media",
    world: "freestyle",
    level: 4,
  },
  {
    id: "ds-scroll-1",
    category: "digitalSkills",
    challengeType: "scroll",
    instruction: "Bajá hasta el final de la página.",
    goal: "Hacer scroll con la rueda del mouse.",
    expectedAction: "scroll:#page:to:bottom",
    successFeedback: "¡Llegaste al final!",
    errorFeedback: "Probá girar la rueda del mouse hacia abajo.",
    difficulty: "facil",
    world: "freestyle",
    level: 5,
  },

  /* ---- Touchpad ---- */
  {
    id: "ds-touchpad-scroll-1",
    category: "digitalSkills",
    challengeType: "touchpadScroll",
    instruction: "Deslizá con dos dedos para subir.",
    goal: "Scroll de dos dedos en el touchpad.",
    expectedAction: "touchpad:twoFingerScroll:up",
    successFeedback: "¡Perfecto! Dos dedos para hacer scroll.",
    errorFeedback: "Usá dos dedos sobre el touchpad y deslizá hacia arriba.",
    difficulty: "media",
    world: "freestyle",
    level: 6,
  },

  /* ---- Windows ---- */
  {
    id: "ds-window-1",
    category: "digitalSkills",
    challengeType: "windowOpen",
    instruction: "Abrí la app de notas.",
    goal: "Abrir una aplicación desde un acceso directo.",
    expectedAction: "window:open:notes",
    successFeedback: "¡Listo! La ventana se abrió.",
    errorFeedback: "Buscá el icono de notas y hacé clic.",
    difficulty: "facil",
    world: "freestyle",
    level: 7,
  },
  {
    id: "ds-window-2",
    category: "digitalSkills",
    challengeType: "windowMinimize",
    instruction: "Minimizá la ventana sin cerrarla.",
    goal: "Distinguir minimizar de cerrar.",
    expectedAction: "window:minimize:active",
    successFeedback: "¡Bien! La ventana sigue ahí, en la barra.",
    errorFeedback: "Apretá el guion del marco, no la X.",
    difficulty: "media",
    world: "freestyle",
    level: 8,
  },
  {
    id: "ds-window-3",
    category: "digitalSkills",
    challengeType: "windowMaximize",
    instruction: "Maximizá la ventana para que ocupe toda la pantalla.",
    goal: "Maximizar una ventana.",
    expectedAction: "window:maximize:active",
    successFeedback: "¡Pantalla completa!",
    errorFeedback: "Es el botón del cuadradito, al lado de la X.",
    difficulty: "media",
    world: "freestyle",
    level: 9,
  },
  {
    id: "ds-window-4",
    category: "digitalSkills",
    challengeType: "windowClose",
    instruction: "Cerrá la ventana que está en primer plano.",
    goal: "Cerrar una ventana.",
    expectedAction: "window:close:active",
    successFeedback: "¡Ventana cerrada!",
    errorFeedback: "La X siempre está arriba a la derecha de la ventana.",
    difficulty: "facil",
    world: "freestyle",
    level: 10,
  },

  /* ---- Tabs ---- */
  {
    id: "ds-tab-1",
    category: "digitalSkills",
    challengeType: "tabOpen",
    instruction: "Abrí una pestaña nueva.",
    goal: "Abrir una nueva pestaña del navegador.",
    expectedAction: "tab:open",
    successFeedback: "¡Pestaña nueva lista!",
    errorFeedback: "Probá el botón + al lado de las pestañas o Ctrl+T.",
    difficulty: "facil",
    world: "freestyle",
    level: 11,
  },
  {
    id: "ds-tab-2",
    category: "digitalSkills",
    challengeType: "tabSwitch",
    instruction: "Cambiá a la pestaña de la izquierda.",
    goal: "Cambiar de pestaña.",
    expectedAction: "tab:switch:prev",
    successFeedback: "¡Cambiaste de pestaña!",
    errorFeedback: "Tocá la pestaña que querés o probá Ctrl+Tab.",
    difficulty: "media",
    world: "freestyle",
    level: 12,
  },
  {
    id: "ds-tab-3",
    category: "digitalSkills",
    challengeType: "tabClose",
    instruction: "Cerrá la pestaña actual.",
    goal: "Cerrar pestañas.",
    expectedAction: "tab:close:active",
    successFeedback: "¡Cerrada!",
    errorFeedback: "Apretá la X de la pestaña o Ctrl+W.",
    difficulty: "media",
    world: "freestyle",
    level: 13,
  },

  /* ---- Shortcuts ---- */
  {
    id: "ds-shortcut-ctrlc",
    category: "digitalSkills",
    challengeType: "shortcut",
    instruction: "Copiá el texto seleccionado.",
    goal: "Atajo de teclado Ctrl+C.",
    expectedAction: "shortcut:Ctrl+C",
    successFeedback: "¡Copiado al portapapeles!",
    errorFeedback: "Mantené Ctrl y apretá C.",
    difficulty: "media",
    world: "freestyle",
    level: 14,
  },
  {
    id: "ds-shortcut-ctrlv",
    category: "digitalSkills",
    challengeType: "shortcut",
    instruction: "Pegá lo que copiaste.",
    goal: "Atajo de teclado Ctrl+V.",
    expectedAction: "shortcut:Ctrl+V",
    successFeedback: "¡Pegado!",
    errorFeedback: "Ctrl + V pega lo último que copiaste.",
    difficulty: "media",
    world: "freestyle",
    level: 15,
  },
  {
    id: "ds-shortcut-ctrlt",
    category: "digitalSkills",
    challengeType: "shortcut",
    instruction: "Abrí una pestaña con el teclado.",
    goal: "Atajo Ctrl+T.",
    expectedAction: "shortcut:Ctrl+T",
    successFeedback: "¡Pestaña nueva sin tocar el mouse!",
    errorFeedback: "Ctrl + T abre una pestaña nueva.",
    difficulty: "dificil",
    world: "freestyle",
    level: 16,
  },
  {
    id: "ds-shortcut-ctrlw",
    category: "digitalSkills",
    challengeType: "shortcut",
    instruction: "Cerrá la pestaña con el teclado.",
    goal: "Atajo Ctrl+W.",
    expectedAction: "shortcut:Ctrl+W",
    successFeedback: "¡Pestaña cerrada con un atajo!",
    errorFeedback: "Ctrl + W cierra la pestaña en la que estás.",
    difficulty: "dificil",
    world: "freestyle",
    level: 17,
  },
  {
    id: "ds-shortcut-ctrltab",
    category: "digitalSkills",
    challengeType: "shortcut",
    instruction: "Pasá a la siguiente pestaña con un atajo.",
    goal: "Atajo Ctrl+Tab.",
    expectedAction: "shortcut:Ctrl+Tab",
    successFeedback: "¡Otra pestaña!",
    errorFeedback: "Ctrl + Tab te lleva a la próxima.",
    difficulty: "experto",
    world: "freestyle",
    level: 18,
  },

  /* ---- Text editing ---- */
  {
    id: "ds-select-text-1",
    category: "digitalSkills",
    challengeType: "selectText",
    instruction: "Seleccioná la palabra resaltada.",
    goal: "Aprender a seleccionar texto.",
    expectedAction: "select:text:#word",
    successFeedback: "¡Seleccionada!",
    errorFeedback: "Hacé clic al principio y arrastrá hasta el final.",
    difficulty: "media",
    world: "freestyle",
    level: 19,
  },
  {
    id: "ds-copy-paste-1",
    category: "digitalSkills",
    challengeType: "copyPaste",
    instruction: "Copiá la frase y pegala en la caja.",
    goal: "Combinar copiar y pegar.",
    expectedAction: "compose:copy+paste:#target",
    successFeedback: "¡Bien! Copiaste y pegaste como un pro.",
    errorFeedback: "Primero seleccioná, después Ctrl+C y por último Ctrl+V.",
    difficulty: "dificil",
    world: "freestyle",
    level: 20,
  },

  /* ---- UI literacy ---- */
  {
    id: "ds-ui-spot-close",
    category: "digitalSkills",
    challengeType: "uiSpotting",
    instruction: "Tocá el botón para cerrar.",
    goal: "Identificar el icono de cerrar (X).",
    expectedAction: "spot:#close",
    successFeedback: "¡Exacto! Esa es la X de cerrar.",
    errorFeedback: "Es el icono con forma de X, casi siempre arriba a la derecha.",
    difficulty: "inicial",
    world: "freestyle",
    level: 21,
  },
  {
    id: "ds-ui-spot-back",
    category: "digitalSkills",
    challengeType: "uiSpotting",
    instruction: "Tocá el botón para volver atrás.",
    goal: "Identificar el icono de volver (flecha).",
    expectedAction: "spot:#back",
    successFeedback: "¡Bien! La flecha siempre te trae de vuelta.",
    errorFeedback: "Es la flecha que apunta a la izquierda.",
    difficulty: "inicial",
    world: "freestyle",
    level: 22,
  },
  {
    id: "ds-ui-spot-menu",
    category: "digitalSkills",
    challengeType: "uiSpotting",
    instruction: "Tocá el botón para abrir el menú.",
    goal: "Identificar el icono de menú (tres rayas).",
    expectedAction: "spot:#menu",
    successFeedback: "¡Sí! Las tres rayitas siempre son el menú.",
    errorFeedback: "Buscá el icono con tres líneas horizontales.",
    difficulty: "inicial",
    world: "freestyle",
    level: 23,
  },
  {
    id: "ds-ui-spot-settings",
    category: "digitalSkills",
    challengeType: "uiSpotting",
    instruction: "Tocá el botón de configuración.",
    goal: "Identificar el icono de ajustes (engranaje).",
    expectedAction: "spot:#settings",
    successFeedback: "¡Configuración encontrada!",
    errorFeedback: "Buscá un engranaje. Casi siempre está al lado de tu perfil.",
    difficulty: "facil",
    world: "freestyle",
    level: 24,
  },
];

export function getSkillChallengesByType(type: DigitalSkillType): SkillChallenge[] {
  return digitalSkillsCatalog.filter((c) => c.challengeType === type);
}

export function getSkillChallengeById(id: string): SkillChallenge | undefined {
  return digitalSkillsCatalog.find((c) => c.id === id);
}
