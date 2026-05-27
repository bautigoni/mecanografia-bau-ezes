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
    <main className="skill-shell page-fade" data-category={challenge.category} data-difficulty={challenge.difficulty}>
      <header className="skill-shell__header">
        <div className="skill-shell__crumbs">
          <span className="skill-shell__kicker">Nivel {challenge.level}</span>
          <strong>{challenge.goal}</strong>
        </div>
        {onExit && (
          <button type="button" className="skill-shell__exit" onClick={onExit} aria-label="Salir">
            ✕ Salir
          </button>
        )}
      </header>

      <p className="skill-shell__instruction">{challenge.instruction}</p>

      <section className="skill-shell__stage" aria-label="Escena de la actividad">
        {children}
      </section>

      <footer className="skill-shell__footer" aria-live="polite">
        <div
          className={`skill-shell__feedback skill-shell__feedback--${status}`}
          style={{ background: STATUS_TONES[status] }}
        >
          {message}
        </div>

        {metrics && (
          <ul className="skill-shell__metrics" aria-label="Métricas">
            <li>Intentos: <strong>{metrics.attempts}</strong></li>
            <li>Errores: <strong>{metrics.errors}</strong></li>
            <li>Tiempo: <strong>{Math.round(metrics.timeMs / 100) / 10}s</strong></li>
          </ul>
        )}

        {actions && <div className="skill-shell__actions">{actions}</div>}
      </footer>
    </main>
  );
}
