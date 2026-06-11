import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getTotalStars } from "../../utils/progress";

/* Persistent, account-wide star counter.
 *
 * Shows the cumulative star total — the sum of the BEST stars earned in every
 * level across every world (see `getTotalStars`). It stays live by listening to
 * the `edutic:progress` event (dispatched on every progress write, e.g. when a
 * level is completed) plus the cross-tab `storage` event, so the number bumps
 * the instant a student finishes a level — even on the gameplay screen itself.
 *
 * Renders only the pill; the mount site decides the position. On the student
 * screens it is dropped in the top-right corner (fixed) so it is visible at all
 * times after login. */
export function StarCounter({ className = "" }: { className?: string }) {
  const [stars, setStars] = useState(() => getTotalStars());

  useEffect(() => {
    const update = () => setStars(getTotalStars());
    update(); // re-read on mount (route change / fresh login)
    window.addEventListener("edutic:progress", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("edutic:progress", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <div
      className={[
        "glass-strong flex items-center gap-1.5 rounded-full pl-2.5 pr-3.5 py-1.5",
        "shadow-md border border-white/60 select-none pointer-events-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${stars} estrellas`}
      title={`${stars} estrellas`}
    >
      <Star
        size={20}
        strokeWidth={1.5}
        className="text-amber-400 drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]"
        fill="currentColor"
      />
      <span className="font-display font-black text-text text-base leading-none tabular-nums">
        {stars}
      </span>
    </div>
  );
}
