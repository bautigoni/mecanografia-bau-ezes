export type ActivityMode = "assisted" | "independent";
export type ActivityInputType = "letter" | "word" | "phrase" | "symbol" | "correction" | "skill";

export interface Activity {
  id: string;
  worldId: "island1" | "island2" | "island3" | "island4" | "island5";
  levelNumber: number;
  level: number;
  title: string;
  subtitle: string;
  instruction: string;
  listenText: string;
  targets: string[];
  mode: ActivityMode;
  type: ActivityInputType;
  inputType: ActivityInputType;
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  description: string;
  requiresShift?: boolean;
  requiresAccent?: boolean;
  /** Set when inputType === "skill" — points at an entry in digitalSkillsCatalog. */
  skillChallengeId?: string;
}

type ActivityDraft = Omit<Activity, "id" | "level" | "type" | "inputType" | "difficulty"> & {
  difficulty?: Activity["difficulty"];
  inputType?: ActivityInputType;
};

function makeActivity(draft: ActivityDraft & { inputType: ActivityInputType; difficulty: Activity["difficulty"] }): Activity {
  return {
    ...draft,
    id: `${draft.worldId}-l${draft.levelNumber}`,
    level: draft.levelNumber,
    type: draft.inputType,
  } as Activity;
}

const world1: Activity[] = [
  makeActivity({
    worldId: "island1",
    levelNumber: 1,
    title: "Mis primeras teclas",
    subtitle: "Conocé la fila central",
    instruction: "Presioná la letra que aparece.",
    listenText: "Buscá la letra que aparece en pantalla.",
    targets: ["A", "S", "D", "F", "J", "K", "L"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Reconocé las teclas de la fila central del teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 2,
    title: "Vocales mágicas",
    subtitle: "Ubicá cada vocal",
    instruction: "Presioná la vocal que aparece.",
    listenText: "Buscá la vocal que aparece en pantalla.",
    targets: ["A", "E", "I", "O", "U", "A", "I"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 1,
    description: "Practicá las cinco vocales.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 3,
    title: "Fila de arriba",
    subtitle: "Q W E R T Y U I O P",
    instruction: "Presioná la letra de la fila de arriba.",
    listenText: "Buscá la letra de la fila superior.",
    targets: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Conocé las letras de la fila superior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 4,
    title: "Fila de abajo",
    subtitle: "Z X C V B N M",
    instruction: "Presioná la letra de la fila inferior.",
    listenText: "Buscá la letra de la fila inferior.",
    targets: ["Z", "X", "C", "V", "B", "N", "M"],
    mode: "assisted",
    inputType: "letter",
    difficulty: 2,
    description: "Practicá las letras de la fila inferior.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 5,
    title: "Mezcla de letras",
    subtitle: "Todo el abecedario",
    instruction: "Presioná la letra correcta sin ayuda visual.",
    listenText: "Presioná la letra correcta.",
    targets: ["G", "H", "P", "B", "N", "F", "T", "L", "M", "R"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Reconocé letras de todo el teclado.",
  }),
  makeActivity({
    worldId: "island1",
    levelNumber: 6,
    title: "Letra veloz",
    subtitle: "Reto final de letras",
    instruction: "Presioná rápido cada letra que aparece.",
    listenText: "Presioná rápido cada letra que aparece.",
    targets: ["F", "J", "D", "K", "S", "L", "A", "Ñ", "G", "H", "R", "U"],
    mode: "independent",
    inputType: "letter",
    difficulty: 3,
    description: "Cerrá el mundo 1 con velocidad y precisión.",
  }),
];

const world2: Activity[] = [
  makeActivity({
    worldId: "island2",
    levelNumber: 1,
    title: "Palabras cortas",
    subtitle: "Tres letras",
    instruction: "Escribí la palabra que aparece.",
    listenText: "Escribí la palabra que aparece en pantalla.",
    targets: ["sol", "luz", "mar", "pan", "rio"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Escribí palabras simples de tres letras.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 2,
    title: "Cosas del cielo",
    subtitle: "Cuatro letras",
    instruction: "Escribí la palabra completa.",
    listenText: "Escribí la palabra completa.",
    targets: ["luna", "nube", "lago", "rosa", "casa"],
    mode: "assisted",
    inputType: "word",
    difficulty: 2,
    description: "Practicá palabras de cuatro letras.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 3,
    title: "Mi mundo",
    subtitle: "Palabras de cinco letras",
    instruction: "Escribí la palabra que ves.",
    listenText: "Escribí la palabra que ves.",
    targets: ["tecla", "amigo", "verde", "fruta", "libro"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Escribí palabras un poco más largas.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 4,
    title: "Animales",
    subtitle: "Palabras de seis letras",
    instruction: "Escribí el nombre del animal.",
    listenText: "Escribí el nombre del animal.",
    targets: ["gato", "perro", "caballo", "tortuga", "conejo"],
    mode: "independent",
    inputType: "word",
    difficulty: 3,
    description: "Practicá palabras de animales conocidos.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 5,
    title: "Dos palabras",
    subtitle: "Usá el espacio",
    instruction: "Escribí las dos palabras separadas por un espacio.",
    listenText: "Escribí las dos palabras separadas por un espacio.",
    targets: ["mi casa", "sol grande", "tecla feliz", "nube blanca"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 4,
    description: "Aprendé a usar la barra espaciadora.",
  }),
  makeActivity({
    worldId: "island2",
    levelNumber: 6,
    title: "Borro y corrijo",
    subtitle: "Usá retroceso",
    instruction: "Si te equivocás, usá Backspace para corregir.",
    listenText: "Si te equivocás, usá retroceso para corregir.",
    targets: ["escuela", "estrella", "tablero", "ventana", "mochila"],
    mode: "independent",
    inputType: "correction",
    difficulty: 4,
    description: "Corregí mientras escribís usando Backspace.",
  }),
];

const world3: Activity[] = [
  makeActivity({
    worldId: "island3",
    levelNumber: 1,
    title: "Mayúsculas mágicas",
    subtitle: "Con Shift",
    instruction: "Escribí cada palabra con la primera letra en mayúscula.",
    listenText: "Escribí cada palabra con mayúscula inicial.",
    targets: ["Sofia", "Lucas", "Maria", "Pedro", "Lima"],
    mode: "assisted",
    inputType: "word",
    difficulty: 3,
    description: "Usá Shift para escribir nombres propios.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 2,
    title: "La ñ especial",
    subtitle: "Letra del español",
    instruction: "Escribí la palabra con la letra ñ.",
    listenText: "Escribí palabras con ñ.",
    targets: ["niño", "año", "piña", "caña", "España"],
    mode: "assisted",
    inputType: "word",
    difficulty: 4,
    description: "Practicá la letra ñ del español.",
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 3,
    title: "Acentos suaves",
    subtitle: "Tildes en palabras",
    instruction: "Escribí la palabra con su tilde.",
    listenText: "Escribí cada palabra con su tilde.",
    targets: ["mamá", "papá", "café", "lápiz", "árbol"],
    mode: "independent",
    inputType: "word",
    difficulty: 4,
    description: "Aprendé a escribir tildes.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 4,
    title: "Palabras con tilde",
    subtitle: "Acentos más largos",
    instruction: "Escribí palabras largas con tilde.",
    listenText: "Escribí palabras largas con tilde.",
    targets: ["camión", "música", "pájaro", "rápido", "técnica"],
    mode: "independent",
    inputType: "word",
    difficulty: 5,
    description: "Reforzá las tildes en palabras largas.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 5,
    title: "¿Preguntas?",
    subtitle: "Signos ¿ y ?",
    instruction: "Escribí la pregunta completa con sus signos.",
    listenText: "Escribí la pregunta completa con sus signos.",
    targets: ["¿Dónde?", "¿Quién?", "¿Cómo estás?", "¿Qué día es?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá los signos de pregunta.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island3",
    levelNumber: 6,
    title: "¡Exclamaciones!",
    subtitle: "Signos ¡ y !",
    instruction: "Escribí la frase con signos de exclamación.",
    listenText: "Escribí la frase con signos de exclamación.",
    targets: ["¡Hola!", "¡Vamos!", "¡Qué lindo!", "¡Buen día, Sofía!"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Cerrá el mundo 3 con signos de exclamación.",
    requiresAccent: true,
  }),
];

const world4: Activity[] = [
  makeActivity({
    worldId: "island4",
    levelNumber: 1,
    title: "Puntos y comas",
    subtitle: "Signos básicos",
    instruction: "Escribí el signo que aparece.",
    listenText: "Escribí cada signo de puntuación.",
    targets: [".", ",", ";", ":", "-", "_"],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 4,
    description: "Reconocé los signos de puntuación.",
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 2,
    title: "Arroba y punto",
    subtitle: "Para correos",
    instruction: "Escribí los símbolos especiales.",
    listenText: "Escribí los símbolos especiales.",
    targets: ["@", ".", "@", "-", "_", "."],
    mode: "assisted",
    inputType: "symbol",
    difficulty: 5,
    description: "Aprendé el arroba y el punto.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 3,
    title: "Mi primer correo",
    subtitle: "Dirección de email",
    instruction: "Escribí la dirección de correo completa.",
    listenText: "Escribí la dirección de correo completa.",
    targets: ["sofia@edutic.com", "lucas@edutic.com", "info@edutic.com"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 5,
    description: "Practicá escribir un correo electrónico.",
    requiresShift: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 4,
    title: "Frases con coma",
    subtitle: "Punto y coma",
    instruction: "Escribí la frase respetando puntos y comas.",
    listenText: "Escribí la frase respetando puntos y comas.",
    targets: ["Hola, Sofía.", "Vamos, ya es hora.", "Sí, claro."],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Frases reales con puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 5,
    title: "Preguntas reales",
    subtitle: "Frases con ¿?",
    instruction: "Escribí la pregunta completa.",
    listenText: "Escribí la pregunta completa.",
    targets: ["¿Listo, Lucas?", "¿Vamos al parque?", "¿Cómo se llama tu mascota?"],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Combiná tildes, signos y puntuación.",
    requiresAccent: true,
  }),
  makeActivity({
    worldId: "island4",
    levelNumber: 6,
    title: "Reto final",
    subtitle: "Todo junto",
    instruction: "Escribí cada frase exactamente como aparece.",
    listenText: "Escribí cada frase tal como aparece.",
    targets: [
      "¡Hola, mundo!",
      "Mi correo es sofia@edutic.com.",
      "¿Estás listo? ¡Vamos!",
      "Año 2026: ¡a escribir!",
    ],
    mode: "independent",
    inputType: "phrase",
    difficulty: 6,
    description: "Reto final con todos los signos del español.",
    requiresAccent: true,
    requiresShift: true,
  }),
];

/* =====================================================================
   World 5 — Isla digital: 7 levels covering mouse / touchpad / shortcuts.
   Each level is an Activity with `inputType: "skill"` and a link to the
   matching entry in `digitalSkillsCatalog` (src/data/digitalSkills.ts).
   The GameplayPage renders these through the SkillChallengeShell instead
   of the typing keyboard pipeline.
===================================================================== */
/* The order and content of each entry below mirrors exactly what
   SkillLevelView renders for the same levelNumber, so the level chip on
   the world map, the spoken consigna and the on-screen UI all describe
   the same mechanic. */
const world5: Activity[] = [
  makeActivity({
    worldId: "island5",
    levelNumber: 1,
    title: "Clic izquierdo",
    subtitle: "Tu primer gesto con el mouse",
    instruction: "Hacé clic sobre los 5 objetos que brillan.",
    listenText: "Hacé un clic con el botón izquierdo del mouse en cada dibujo.",
    targets: ["click:primary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 1,
    description: "Aprendé a hacer clic con el botón principal del mouse sobre cada objeto.",
    skillChallengeId: "ds-click-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 2,
    title: "Clic derecho",
    subtitle: "Menús secretos",
    instruction: "Hacé clic derecho sobre el objeto que te indica la consigna.",
    listenText: "Hacé clic con el botón derecho del mouse para abrir el menú secreto.",
    targets: ["click:secondary"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Descubrí los menús que esconde el clic derecho sobre cofres, mochilas y pociones.",
    skillChallengeId: "ds-click-2",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 3,
    title: "Arrastrar y soltar",
    subtitle: "Drag & drop",
    instruction: "Arrastrá cada objeto y soltalo en la silueta que coincide.",
    listenText: "Mantené apretado el botón izquierdo y movelo hasta el destino correcto.",
    targets: ["drag:item"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Practicá arrastrar y soltar — los destinos están mezclados.",
    skillChallengeId: "ds-drag-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 4,
    title: "Ventanas y pestañas",
    subtitle: "Sistema virtual",
    instruction: "Abrí y cerrá ventanas y pestañas según las tareas.",
    listenText: "Cerrá las ventanas y pestañas que te pide la tarea.",
    targets: ["window:close", "tab:open", "tab:close"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Aprendé a manejar ventanas y pestañas del escritorio.",
    skillChallengeId: "ds-tab-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 5,
    title: "Scroll y zoom",
    subtitle: "Rueda del mouse",
    instruction: "Desplazate por la imagen del castillo y después acercá y alejá el zoom.",
    listenText: "Usá la rueda del mouse para subir y bajar, y los botones más y menos para hacer zoom.",
    targets: ["scroll:page", "zoom:in", "zoom:out"],
    mode: "independent",
    inputType: "skill",
    difficulty: 3,
    description: "Hacé scroll para revelar la imagen y practicá zoom in y zoom out.",
    skillChallengeId: "ds-scroll-1",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 6,
    title: "Doble clic",
    subtitle: "Abrir carpetas",
    instruction: "Hacé doble clic rápido sobre cada carpeta para abrirla.",
    listenText: "Dos clics seguidos sobre la carpeta y se abre.",
    targets: ["click:double"],
    mode: "assisted",
    inputType: "skill",
    difficulty: 2,
    description: "Diferenciá el clic simple del doble clic para abrir carpetas mágicas.",
    skillChallengeId: "ds-click-3",
  }),
  makeActivity({
    worldId: "island5",
    levelNumber: 7,
    title: "Atajos del teclado",
    subtitle: "Ctrl + letra",
    instruction: "Usá Ctrl + C, Ctrl + V, Ctrl + T y Ctrl + W según se pida.",
    listenText: "Combinaciones de teclas para copiar, pegar y manejar pestañas.",
    targets: ["shortcut:Ctrl+C", "shortcut:Ctrl+V", "shortcut:Ctrl+T", "shortcut:Ctrl+W"],
    mode: "independent",
    inputType: "skill",
    difficulty: 4,
    description: "Reto final: dominá los cuatro atajos más usados del navegador.",
    skillChallengeId: "ds-shortcut-ctrlc",
  }),
];

export const activities: Activity[] = [...world1, ...world2, ...world3, ...world4, ...world5];

export const activitiesByWorld: Record<Activity["worldId"], Activity[]> = {
  island1: world1,
  island2: world2,
  island3: world3,
  island4: world4,
  island5: world5,
};

export const levelActivityIds = activities.map((activity) => activity.id);

export function getActivityById(id?: string): Activity {
  return activities.find((activity) => activity.id === id) ?? activities[0];
}

export function getActivitiesForWorld(worldId: Activity["worldId"]): Activity[] {
  return activitiesByWorld[worldId];
}
