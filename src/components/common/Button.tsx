import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-btn hover:shadow-btn-hover",
  /* Quieter than primary on purpose: secondary actions must never compete
     visually with the main CTA (jerarquía visual). */
  secondary:
    "bg-white/55 text-text/90 hover:bg-white/85 hover:text-text",
  ghost:
    "bg-transparent text-text hover:bg-white/40",
  danger:
    "bg-rose text-white shadow hover:brightness-105",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center min-h-[2.75rem] px-4 gap-1.5 rounded-xl font-bold cursor-pointer transition-all duration-180 ease hover:-translate-y-0.5 active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none";

  return (
    <button
      className={`${base} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
