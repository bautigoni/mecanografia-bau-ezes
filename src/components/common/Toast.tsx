import { useEffect, useRef, useState } from "react";

/* =====================================================================
 * Toast — self-managing bottom-right notification stack.
 *
 * Pages keep their existing API (`<Toast message={message} />`): each time
 * the `message` prop changes to a new, non-empty string, a toast is pushed.
 * The component then guarantees the behaviour the product needs:
 *   - auto-dismiss after AUTO_DISMISS_MS,
 *   - at most MAX_VISIBLE on screen (oldest is dropped when exceeded),
 *   - identical text already visible is de-duplicated (its timer is
 *     refreshed instead of adding a second copy),
 * so notifications can never stack infinitely or linger forever.
 * ===================================================================== */

interface ToastItem {
  id: number;
  text: string;
}

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;

export function Toast({ message }: { message: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const seq = useRef(0);

  // Push / refresh a toast whenever the incoming message changes.
  useEffect(() => {
    const text = (message ?? "").trim();
    if (!text) return;

    setItems((prev) => {
      // De-dupe: if the same text is already visible, give it a fresh id so
      // the timer effect reschedules its dismissal — no duplicate toast.
      if (prev.some((item) => item.text === text)) {
        return prev.map((item) =>
          item.text === text ? { ...item, id: ++seq.current } : item,
        );
      }
      const next = [...prev, { id: ++seq.current, text }];
      // Cap at MAX_VISIBLE, dropping the oldest entries.
      return next.slice(-MAX_VISIBLE);
    });
  }, [message]);

  // Keep one auto-dismiss timer per visible toast, and clean up timers for
  // toasts that have been removed (or replaced as the oldest).
  useEffect(() => {
    const active = timers.current;

    items.forEach((item) => {
      if (active.has(item.id)) return;
      const timer = setTimeout(() => {
        active.delete(item.id);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, AUTO_DISMISS_MS);
      active.set(item.id, timer);
    });

    for (const [id, timer] of active) {
      if (!items.some((i) => i.id === id)) {
        clearTimeout(timer);
        active.delete(id);
      }
    }
  }, [items]);

  // Clear every timer on unmount.
  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((timer) => clearTimeout(timer));
      active.clear();
    };
  }, []);

  function dismiss(id: number) {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast select-none">
          <span className="toast__text">{item.text}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Cerrar notificación"
            onClick={() => dismiss(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
