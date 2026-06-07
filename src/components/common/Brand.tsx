export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center text-text ${
        compact ? "gap-2.5" : "gap-3.2"
      }`}
    >
      <span
        className={`grid place-items-center border border-white/95 rounded-[1.05rem] bg-gradient-to-br from-accent-sky/30 via-accent/20 to-accent-teal/15 shadow-card text-accent-strong font-black ${
          compact
            ? "w-[2.5rem] h-[2.5rem] text-[1.25rem]"
            : "w-[3.1rem] h-[3.1rem] text-[1.55rem]"
        }`}
      >
        T
      </span>
      <span className="text-[clamp(1.45rem,2.5vw,2rem)] font-black">
        TYPELY
      </span>
    </div>
  );
}
