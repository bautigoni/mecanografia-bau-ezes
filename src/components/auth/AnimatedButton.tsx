import type { ButtonHTMLAttributes, ReactNode } from "react";

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  variant?: "primary" | "secondary";
}

export function AnimatedButton({
  children,
  className = "",
  iconLeft,
  iconRight,
  variant = "primary",
  ...props
}: AnimatedButtonProps) {
  return (
    <button className={`auth-button auth-button--${variant} ${className}`.trim()} {...props}>
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
}
