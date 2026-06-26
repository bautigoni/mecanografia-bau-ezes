/* =====================================================================
   cssSelector — genera un selector CSS LIMPIO y CORTO para un elemento.

   Prioridad (requisito 5):
     1. #id                    (si es único)
     2. [data-testid="…"]      (si es único)
     3. tag.clase-semántica    (descarta clases utilitarias tipo Tailwind)
     4. ruta corta (≤ 3 niveles) con :nth-of-type, anclada al ancestro
        identificable más cercano. Evita selectores larguísimos.
   ===================================================================== */

/** Escapa un identificador para usarlo en un selector. */
function esc(value: string): string {
  // CSS.escape existe en todos los navegadores modernos; fallback defensivo.
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/** ¿El selector matchea exactamente UN elemento en el documento? */
function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

/* Clases que NO sirven como selector semántico: utilitarias de Tailwind /
   estados / responsive. Heurística: si matchea esto, la descartamos. */
const UTILITY_RE =
  /^(?:[a-z]+:)|[:/[\]]|^(?:flex|grid|block|inline|hidden|table|contents|flow-root|isolate|absolute|relative|fixed|sticky|static|container)$|^(?:[wh]|min-[wh]|max-[wh]|p[trblxy]?|m[trblxy]?|gap|space|inset|top|left|right|bottom|z|order|col|row|basis|grow|shrink)-|^(?:text|bg|from|via|to|fill|stroke|border|ring|divide|outline|shadow|rounded|opacity|blur|backdrop|brightness|saturate|contrast|grayscale|leading|tracking|font|italic|uppercase|lowercase|capitalize|truncate|whitespace|break|align|justify|items|content|self|place|object|overflow|cursor|select|pointer|resize|scroll|snap|touch|will|animate|transition|duration|delay|ease|transform|translate|rotate|scale|skew|origin|aspect|columns|float|clear|antialiased|sr-only|not-sr-only|decoration|underline|line-through|no-underline|tabular-nums|drop-shadow)/;

/** Elige la primera clase "semántica" (de componente) del elemento, o null. */
function pickSemanticClass(el: Element): string | null {
  const classes = Array.from(el.classList);
  for (const c of classes) {
    if (c.length >= 3 && !UTILITY_RE.test(c)) return c;
  }
  return null;
}

/** Índice :nth-of-type del elemento entre sus hermanos del mismo tag (1-based). */
function nthOfType(el: Element): number {
  let i = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i++;
    sib = sib.previousElementSibling;
  }
  return i;
}

/** Un "paso" del path: tag, + .clase semántica si la hay, + :nth-of-type. */
function step(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const semantic = pickSemanticClass(el);
  if (semantic) return `${tag}.${esc(semantic)}`;
  const nth = nthOfType(el);
  return nth > 1 ? `${tag}:nth-of-type(${nth})` : tag;
}

/** Ruta corta: sube hasta 3 niveles o hasta encontrar un ancestro con id. */
function shortPath(el: HTMLElement): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node !== document.body && depth < 3) {
    if (node instanceof HTMLElement && node.id) {
      parts.unshift(`#${esc(node.id)}`);
      return parts.join(" > ");
    }
    parts.unshift(step(node));
    node = node.parentElement;
    depth++;
  }
  // Nunca devolver vacío (p. ej. si se clickea el propio <body>).
  return parts.join(" > ") || el.tagName.toLowerCase();
}

/** Punto de entrada: el mejor selector limpio para `el`. */
export function buildSelector(el: HTMLElement): string {
  // 1) id
  if (el.id) {
    const sel = `#${esc(el.id)}`;
    if (isUnique(sel)) return sel;
  }
  // 2) data-testid
  const testId = el.getAttribute("data-testid");
  if (testId) {
    const sel = `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
    if (isUnique(sel)) return sel;
  }
  // 3) tag.clase-semántica
  const semantic = pickSemanticClass(el);
  if (semantic) {
    const sel = `${el.tagName.toLowerCase()}.${esc(semantic)}`;
    if (isUnique(sel)) return sel;
  }
  // 4) ruta corta
  return shortPath(el);
}

/** Etiqueta legible del elemento para mostrar en el panel (no selector). */
export function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const semantic = pickSemanticClass(el);
  const cls = semantic ? `.${semantic}` : "";
  return `${tag}${id}${cls}`;
}
