import type { ReactNode } from "react";

interface GlassInputProps {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  action?: ReactNode;
}

export function GlassInput({
  action,
  autoComplete,
  icon,
  label,
  onChange,
  type = "text",
  value,
}: GlassInputProps) {
  return (
    <label className="grid gap-2">
      <span className="absolute w-px h-px overflow-hidden whitespace-nowrap clip-0">
        {label}
      </span>
      <span className="glass-surface grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-xl h-[clamp(3rem,5vmin,3.9rem)] px-3">
        <span className="text-muted grid place-items-center">{icon}</span>
        <input
          className="bg-transparent outline-none text-text placeholder:text-muted/60 w-full h-full"
          style={{ fontSize: "clamp(1.3rem,2.2vmin,1.9rem)" }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          autoComplete={autoComplete}
          placeholder={label}
        />
        {action}
      </span>
    </label>
  );
}
