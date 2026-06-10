export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`inline-flex items-center text-text ${
        compact ? "gap-2.5" : "gap-3.2"
      }`}
    >
      <img
        src="/favicon-256.png"
        alt=""
        decoding="async"
        className={`rounded-xl shadow-card border border-white/80 bg-gradient-to-br from-accent-sky/20 to-accent/10 object-contain ${
          compact ? "w-[2.5rem] h-[2.5rem]" : "w-[3.1rem] h-[3.1rem]"
        }`}
      />
      <span className="font-display text-[clamp(1.45rem,2.5vw,2rem)] font-black tracking-wide bg-gradient-to-r from-accent-sky via-accent to-accent-pink bg-clip-text text-transparent">
        TYPELY
      </span>
    </div>
  );
}
