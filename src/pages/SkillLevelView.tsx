import { ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity } from "../data/activities";
import {
  getSkillChallengeById,
  type SkillChallenge,
  type SkillMetrics,
} from "../data/digitalSkills";
import { SkillChallengeShell } from "../components/digitalSkills/SkillChallengeShell";
import { markLevelComplete } from "../utils/progress";

interface SkillLevelViewProps {
  activity: Activity;
}

/**
 * Renders an island-5 (digital-skills) level. The actual interactive
 * simulator (mock desktop / browser) is a separate, larger build — for
 * now we render a minimal pastel placeholder that:
 *   - declares the expected gesture (e.g., "click", "shortcut Ctrl+W"),
 *   - lets the kid press it via mouse / keyboard,
 *   - tracks metrics + marks the level complete in localStorage.
 */
export function SkillLevelView({ activity }: SkillLevelViewProps) {
  const navigate = useNavigate();
  const challenge = useMemo<SkillChallenge | undefined>(
    () => (activity.skillChallengeId ? getSkillChallengeById(activity.skillChallengeId) : undefined),
    [activity.skillChallengeId],
  );

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [metrics, setMetrics] = useState<SkillMetrics>({ attempts: 0, errors: 0, timeMs: 0, completed: false });
  const [done, setDone] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const persistedRef = useRef(false);

  /* Tick the elapsed timer until the level is completed. */
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setMetrics((current) => ({ ...current, timeMs: Date.now() - startedAt.current }));
    }, 200);
    return () => window.clearInterval(id);
  }, [done]);

  function persist() {
    if (persistedRef.current) return;
    persistedRef.current = true;
    const accuracy = Math.max(0, Math.round(((metrics.attempts - metrics.errors) / Math.max(1, metrics.attempts)) * 100));
    markLevelComplete(activity.worldId, activity.levelNumber, accuracy, Math.max(1, metrics.attempts));
  }

  function complete() {
    setMetrics((current) => ({ ...current, completed: true }));
    setStatus("success");
    setDone(true);
    persist();
  }

  function registerAttempt(success: boolean) {
    setMetrics((current) => ({
      ...current,
      attempts: current.attempts + 1,
      errors: success ? current.errors : current.errors + 1,
    }));
    if (success) complete();
    else setStatus("error");
  }

  function retry() {
    setStatus("idle");
    setMetrics({ attempts: 0, errors: 0, timeMs: 0, completed: false });
    setDone(false);
    startedAt.current = Date.now();
    persistedRef.current = false;
  }

  /* The challenge declares its expected gesture via challenge.expectedAction
     (e.g., "click:primary:#target", "shortcut:Ctrl+W"). The placeholder
     simulator below interprets a tiny subset of those: every challenge can
     be solved either by clicking its target button (when present) or by
     pressing the declared shortcut keys. The full simulator will replace
     this with a real mock desktop / browser scene later. */
  const isShortcut = challenge?.expectedAction.startsWith("shortcut:");
  const shortcutKeys = useMemo(() => {
    if (!isShortcut || !challenge) return [];
    return challenge.expectedAction.replace("shortcut:", "").split("+");
  }, [challenge, isShortcut]);

  useEffect(() => {
    if (!isShortcut || done) return;
    function onKey(event: KeyboardEvent) {
      // Build a normalized combo from the event.
      const parts: string[] = [];
      if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
      if (event.shiftKey) parts.push("Shift");
      if (event.altKey) parts.push("Alt");
      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) parts.push(key);

      const got = parts.join("+");
      const want = shortcutKeys.join("+");
      if (got.toUpperCase() === want.toUpperCase()) {
        event.preventDefault();
        registerAttempt(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShortcut, done, shortcutKeys.join("+")]);

  if (!challenge) {
    return (
      <main className="skill-shell page-fade">
        <p style={{ textAlign: "center" }}>Esta actividad no está configurada todavía.</p>
        <button type="button" onClick={() => navigate(`/worlds/${activity.worldId}`)}>Volver a la isla</button>
      </main>
    );
  }

  return (
    <SkillChallengeShell
      challenge={challenge}
      metrics={metrics}
      status={done ? "success" : status}
      onExit={() => navigate(`/worlds/${activity.worldId}`)}
      actions={
        done ? (
          <button
            type="button"
            className="skill-shell__cta"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
          >
            <ArrowRight size={18} />
            Volver a la isla
          </button>
        ) : (
          <button type="button" className="skill-shell__ghost" onClick={retry}>
            <RotateCcw size={16} />
            Reintentar
          </button>
        )
      }
    >
      {/* Minimal placeholder scene. The real simulator (mock desktop /
          browser with windows, tabs, drag areas) plugs in here later. */}
      <div className="skill-stage">
        <div className="skill-stage__chip">
          <span>Objetivo</span>
          <strong>{challenge.goal}</strong>
        </div>

        {isShortcut ? (
          <div className="skill-stage__combo" aria-label={`Combinación: ${shortcutKeys.join(" + ")}`}>
            {shortcutKeys.map((key, i) => (
              <span key={`${key}-${i}`} className="skill-stage__combo-step">
                {i > 0 && <span className="skill-stage__combo-plus">+</span>}
                <kbd>{key}</kbd>
              </span>
            ))}
            <p className="skill-stage__hint">Presioná las teclas a la vez.</p>
          </div>
        ) : (
          <button
            type="button"
            className="skill-stage__target"
            onClick={() => registerAttempt(true)}
            onContextMenu={(event) => {
              if (challenge.expectedAction.startsWith("click:secondary")) {
                event.preventDefault();
                registerAttempt(true);
              }
            }}
            onDoubleClick={() => {
              if (challenge.expectedAction.startsWith("click:double")) registerAttempt(true);
            }}
          >
            {challenge.expectedAction.startsWith("click:secondary")
              ? "Hacé clic derecho aquí"
              : challenge.expectedAction.startsWith("click:double")
              ? "Hacé doble clic aquí"
              : challenge.expectedAction.startsWith("drag")
              ? "Soltá el ítem aquí"
              : challenge.expectedAction.startsWith("scroll")
              ? "Hacé scroll y tocá aquí"
              : "Tocá aquí"}
          </button>
        )}
      </div>
    </SkillChallengeShell>
  );
}
