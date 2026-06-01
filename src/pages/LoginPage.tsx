import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassInput } from "../components/auth/GlassInput";
import { AnimatedButton } from "../components/auth/AnimatedButton";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { routeForRole } from "../utils/storage";
import { clearDemoProgressOnly } from "../utils/progress";
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
  const [showDemoModal, setShowDemoModal] = useState(false);
  const { loginAny, loginDemo, loginGoogle } = useAuth();
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

  /** Demo mode — ask whether to keep the previous demo progress or start
      fresh before entering. */
  function openDemoModal() {
    setShowDemoModal(true);
  }

  function enterDemo(reset: boolean) {
    /* Only clears the demo/local level-progress key — never real user, teacher
       or admin data, and never localStorage.clear(). */
    if (reset) clearDemoProgressOnly();
    setShowDemoModal(false);
    const nextUser = loginDemo("superadmin");
    navigate(routeForRole(nextUser.role));
  }

  /** Placeholder Google sign-in (see useAuth.loginGoogle TODO). */
  function googleLogin() {
    const nextUser = loginGoogle();
    if (nextUser) navigate(routeForRole(nextUser.role));
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

          {/* Google sign-in */}
          <button type="button" className="google-login-btn" onClick={googleLogin}>
            <span className="google-login-btn__icon" aria-hidden="true">
              <GoogleGlyph />
            </span>
            Login with Google
          </button>

          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={openDemoModal}
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

      {showDemoModal && (
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
          <div className="demo-modal__backdrop" onClick={() => setShowDemoModal(false)} />
          <div className="demo-modal__card">
            <span className="demo-modal__icon" aria-hidden="true"><Rocket size={26} /></span>
            <h2 id="demo-modal-title">Modo demo</h2>
            <p>¿Querés continuar con el progreso anterior o empezar desde cero?</p>
            <div className="demo-modal__actions">
              <button type="button" className="demo-modal__btn demo-modal__btn--primary" onClick={() => enterDemo(false)}>
                Continuar
              </button>
              <button type="button" className="demo-modal__btn demo-modal__btn--ghost" onClick={() => enterDemo(true)}>
                Empezar de cero
              </button>
            </div>
            <button type="button" className="demo-modal__close" aria-label="Cerrar" onClick={() => setShowDemoModal(false)}>
              ✕
            </button>
          </div>
        </div>
      )}

      <Toast message={message} />
    </main>
  );
}

/* Official Google "G" mark, rendered inline so the button needs no asset. */
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9081c1.7018-1.5668 2.6842-3.874 2.6842-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9081-2.2581c-.806.54-1.8368.859-3.0483.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"/>
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/>
    </svg>
  );
}
