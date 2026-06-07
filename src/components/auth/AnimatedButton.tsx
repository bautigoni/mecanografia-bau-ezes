import type { ButtonHTMLAttributes, ReactNode } from "react";

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  variant?: "primary" | "secondary";
}

const variantClasses: Record<"primary" | "secondary", string> = {
  primary:
    "bg-accent bg-gradient-to-br from-white/24 via-transparent to-transparent text-white shadow-btn hover:shadow-btn-hover",
  secondary:
    "bg-white/75 text-text shadow hover:bg-white/90",
};

export function AnimatedButton({
  children,
  className = "",
  iconLeft,
  iconRight,
  variant = "primary",
  ...props
}: AnimatedButtonProps) {
  const base =
    "inline-flex items-center justify-center min-h-[3.65rem] px-6 gap-1.5 rounded-xl font-extrabold cursor-pointer transition-transform duration-180 ease hover:-translate-y-0.5 active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none";

  return (
    <button
      className={`${base} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}
