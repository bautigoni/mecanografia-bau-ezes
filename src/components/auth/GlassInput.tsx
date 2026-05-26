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

export function GlassInput({ action, autoComplete, icon, label, onChange, type = "text", value }: GlassInputProps) {
  return (
    <label className="login-field">
      <span className="sr-only">{label}</span>
      <span className="input-shell">
        {icon}
        <input
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
