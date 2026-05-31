import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Role } from "../types";
import { GlassInput } from "../components/auth/GlassInput";
import { AnimatedButton } from "../components/auth/AnimatedButton";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { routeForRole } from "../utils/storage";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Rocket,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

/* =====================================================================
   Login page — student-first design.
   Students just enter username + password; the app auto-detects their
   role and routes them to the right screen.  Staff (teachers, admins)
   use the same form — no role picker is shown, role comes from their
   account.

   Dev/demo mode: a hidden "Entrar en modo demo" button lets you log in
   as the default demo student without any credentials.
   Staff can still log in with their real usernames.
===================================================================== */
export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const { loginAny, loginDemo } = useAuth();
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimUser = username.trim();
    const nextUser = loginAny(trimUser, password);

    if (!nextUser) {
      setMessage("Revisá tu usuario y contraseña para ingresar.");
      return;
    }

    navigate(routeForRole(nextUser.role));
  }

  /** Demo shortcut — logs in as the default demo student (sofia / alumno). */
  function enterDemoStudent() {
    const nextUser = loginDemo("alumno" as Role);
    navigate(routeForRole(nextUser.role));
  }

  return (
    <main
      className="login-page page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      <img
        className="login-mascot login-mascot--left"
        src={assets.mascotFemaleWave}
        alt="Mascota saludando"
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by Chrome/Edge/Safari
        fetchpriority="high"
      />
      <img
        className="login-mascot login-mascot--right"
        src={assets.mascotMaleWave}
        alt="Mascota saludando"
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by Chrome/Edge/Safari
        fetchpriority="high"
      />

      <section className="login-card" aria-label="Ingreso a TYPELY">
        <span className="login-card__halo" aria-hidden="true" />
        <span className="login-card__sparkle login-card__sparkle--left" aria-hidden="true">
          ✦
        </span>
        <span className="login-card__sparkle login-card__sparkle--right" aria-hidden="true">
          ✦
        </span>
        <span className="login-card__sparkle login-card__sparkle--top" aria-hidden="true">
          ✧
        </span>

        <div className="login-card__copy">
          <h1>Bienvenido a TYPELY</h1>
          <p>Aprendé a escribir jugando entre las nubes ✨</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <GlassInput
            icon={<User size={21} aria-hidden="true" />}
            label="Código o usuario"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />

          <GlassInput
            icon={<ShieldCheck size={21} aria-hidden="true" />}
            label="Contraseña"
            value={password}
            onChange={setPassword}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            action={
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPassword((v) => !v)}
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

          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={enterDemoStudent}
            iconLeft={<Rocket size={19} aria-hidden="true" />}
          >
            Entrar en modo demo
          </AnimatedButton>

          <p className="login-card__safety">
            <LockKeyhole size={15} aria-hidden="true" />
            Entorno seguro para aprender y enseñar
          </p>
        </form>
      </section>

      <Toast message={message} />
    </main>
  );
}
