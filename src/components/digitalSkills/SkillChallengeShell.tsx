import type { ReactNode } from "react";
import type { SkillChallenge, SkillMetrics } from "../../data/digitalSkills";

/**
 * Pastel shell used by every digital-skills challenge. It owns the chrome
 * (header, instruction, feedback strip, metrics) and lets each challenge
 * render its own scene through the `children` slot — that scene will, in
 * the future, be a mini desktop / browser simulator with windows, tabs and
 * pointer events.
 *
 * Today the simulator doesn't exist yet, so this component is intentionally
 * dumb: it draws the frame, exposes the feedback channel via props, and
 * delegates everything else to the caller.
 */
export interface SkillChallengeShellProps {
  challenge: SkillChallenge;
  /** Live metrics — usually held by the caller's state. */
  metrics?: SkillMetrics;
  /** "idle" | "success" | "error". Drives the feedback banner colouring. */
  status?: "idle" | "success" | "error";
  /** Custom message overriding the catalog feedback (e.g. "intentá de nuevo"). */
  messageOverride?: string;
  /** Right-side action buttons (e.g. Reintentar, Siguiente). */
  actions?: ReactNode;
  /** The actual scene — desktop simulator, browser sim, drag area, etc. */
  children: ReactNode;
  /** Top-left exit affordance. */
  onExit?: () => void;
}

const STATUS_TONES = {
  idle: "rgba(255, 255, 255, 0.72)",
  success: "linear-gradient(135deg, rgba(156, 245, 143, 0.92), rgba(88, 206, 114, 0.92))",
  error: "linear-gradient(135deg, rgba(255, 178, 76, 0.95), rgba(255, 130, 64, 0.95))",
} as const;

export function SkillChallengeShell({
  challenge,
  metrics,
  status = "idle",
  messageOverride,
  actions,
  children,
  onExit,
}: SkillChallengeShellProps) {
  const message =
    messageOverride ??
    (status === "success"
      ? challenge.successFeedback
      : status === "error"
      ? challenge.errorFeedback
      : challenge.instruction);

  return (
    <main
      className="grid grid-rows-[auto_auto_1fr_auto] h-dvh animate-page-fade"
      data-category={challenge.category}
      data-difficulty={challenge.difficulty}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4 p-4 glass-strong border-b border-white/40">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">
            Nivel {challenge.level}
          </span>
          <strong className="text-text text-lg font-display font-extrabold">
            {challenge.goal}
          </strong>
        </div>
        {onExit && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-muted hover:bg-rose/10 hover:text-rose transition cursor-pointer"
            onClick={onExit}
            aria-label="Salir"
          >
            ✕ Salir
          </button>
        )}
      </header>

      {/* ── Instruction ── */}
      <p className="px-4 pt-3 pb-1 text-sm text-muted font-bold animate-soft-hint-in">
        {challenge.instruction}
      </p>

      {/* ── Stage (scene slot) ── */}
      <section className="flex-1 p-4" aria-label="Escena de la actividad">
        {children}
      </section>

      {/* ── Footer: feedback + metrics + actions ── */}
      <footer className="flex flex-col gap-3 p-4 glass-strong border-t border-white/40" aria-live="polite">
        {/* Feedback banner */}
        <div
          className={`rounded-xl px-4 py-3 text-sm font-bold text-center transition-all duration-200 ${
            status === "success"
              ? "text-emerald-900"
              : status === "error"
              ? "text-orange-900"
              : "text-text"
          }`}
          style={{ background: STATUS_TONES[status] }}
        >
          {message}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          {metrics && (
            <ul className="flex items-center gap-4 text-sm text-muted font-bold" aria-label="Métricas">
              <li>
                Intentos: <strong className="text-text">{metrics.attempts}</strong>
              </li>
              <li>
                Errores: <strong className="text-text">{metrics.errors}</strong>
              </li>
              <li>
                Tiempo: <strong className="text-text">{Math.round(metrics.timeMs / 100) / 10}s</strong>
              </li>
            </ul>
          )}

          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
      </footer>
    </main>
  );
}
