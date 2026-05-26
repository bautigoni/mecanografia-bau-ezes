import { ArrowRight, Eye, EyeOff, LockKeyhole, Rocket, ShieldCheck, Sparkles, User } from "lucide-react";
import { FormEvent, useState } from "react";
import type { Role } from "../../types";
import { AnimatedButton } from "./AnimatedButton";
import { GlassInput } from "./GlassInput";
import { RoleSelector } from "./RoleSelector";

interface LoginCardProps {
  role: Role;
  username: string;
  password: string;
  onRoleChange: (role: Role) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onDemo: () => void;
}

export function LoginCard({
  onDemo,
  onPasswordChange,
  onRoleChange,
  onSubmit,
  onUsernameChange,
  password,
  role,
  username,
}: LoginCardProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="login-card" aria-label="Ingreso a TYPELY">
      <span className="login-card__halo" aria-hidden="true" />
      <span className="login-card__sparkle login-card__sparkle--left" aria-hidden="true">✦</span>
      <span className="login-card__sparkle login-card__sparkle--right" aria-hidden="true">✦</span>
      <span className="login-card__sparkle login-card__sparkle--top" aria-hidden="true">✧</span>

      <div className="edutic-login-brand">
        <span className="edutic-login-brand__mark" aria-hidden="true">
          <Sparkles size={32} strokeWidth={2.6} />
        </span>
        <span className="edutic-login-brand__wordmark">TYPELY</span>
      </div>

      <div className="login-card__copy">
        <h1>Bienvenido a TYPELY</h1>
        <p>Aprendé a escribir jugando entre las nubes ✨</p>
      </div>

      <form onSubmit={onSubmit} className="login-form">
        <RoleSelector role={role} onChange={onRoleChange} />

        <GlassInput
          icon={<User size={21} aria-hidden="true" />}
          label="Código o usuario"
          value={username}
          onChange={onUsernameChange}
          autoComplete="username"
        />

        <GlassInput
          icon={<ShieldCheck size={21} aria-hidden="true" />}
          label="Contraseña"
          value={password}
          onChange={onPasswordChange}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          action={
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          }
        />

        <AnimatedButton
          type="submit"
          iconLeft={<Sparkles size={21} aria-hidden="true" />}
          iconRight={<ArrowRight size={23} aria-hidden="true" />}
        >
          Ingresar
        </AnimatedButton>
        <AnimatedButton type="button" variant="secondary" onClick={onDemo} iconLeft={<Rocket size={19} aria-hidden="true" />}>
          Entrar en modo demo
        </AnimatedButton>

        <p className="login-card__safety">
          <LockKeyhole size={15} aria-hidden="true" />
          Entorno seguro para aprender y enseñar
        </p>
      </form>
    </section>
  );
}
