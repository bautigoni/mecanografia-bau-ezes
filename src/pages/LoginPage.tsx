import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassInput } from "../components/auth/GlassInput";
import { AnimatedButton } from "../components/auth/AnimatedButton";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { assets } from "../utils/assets";
import { routeForRole } from "../utils/storage";
import { clearDemoProgressOnly } from "../utils/progress";
import { getGoogleClientId, promptGoogleSignIn } from "../utils/googleAuth";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimUser = username.trim();
    const nextUser = await loginAny(trimUser, password);

    if (!nextUser) {
      setMessage("Revisá tu usuario y contraseña para ingresar.");
      return;
    }

    // Temporary-password sign-ins must set a new password first.
    if (nextUser.mustChangePassword) {
      navigate("/cambiar-contrasena");
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
    // Demo mode ALWAYS enters as the lowest-privilege student → game map.
    // It can never reach an admin/teacher surface.
    const nextUser = loginDemo();
    navigate(routeForRole(nextUser.role));
  }

  /** Google sign-in via Google Identity Services. Opens the GIS popup,
   *  then matches the returned email against Typely's user store. */
  async function googleLogin() {
    if (!getGoogleClientId()) {
      setMessage("Google Login no está configurado. Pedile a tu administrador que cargue VITE_GOOGLE_CLIENT_ID en el servidor.");
      return;
    }
    setMessage(""); // clear any prior error before opening the prompt
    await promptGoogleSignIn({
      onCredential: async (credential) => {
        const result = await loginGoogle(credential);
        if (result.ok) {
          if (result.user.mustChangePassword) {
            navigate("/cambiar-contrasena");
            return;
          }
          navigate(routeForRole(result.user.role));
          return;
        }
        if (result.reason === "DOMAIN_NOT_ALLOWED") {
          setMessage("Tu dominio de correo no está habilitado para Typely.");
        } else if (result.reason === "USER_NOT_FOUND") {
          setMessage("No encontramos una cuenta asociada a este correo. Pedile acceso a tu administrador.");
        } else if (result.reason === "NETWORK_ERROR") {
          setMessage("No pudimos conectar con el servidor. Probá de nuevo.");
        } else {
          setMessage("No pudimos validar tu cuenta de Google. Probá de nuevo.");
        }
      },
      onError: (reason) => {
        if (reason === "MISSING_CLIENT_ID") {
          setMessage("Google Login no está configurado.");
        } else if (reason === "GIS_LOAD_FAILED") {
          setMessage("No se pudo cargar Google. Revisá tu conexión.");
        } else {
          setMessage("No se pudo abrir el inicio con Google. Probá de nuevo.");
        }
      },
    });
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center flex items-center justify-center animate-page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      <img
        className="absolute bottom-0 left-0 w-auto max-h-[52vh] animate-mascot-float pointer-events-none select-none z-10"
        src={assets.mascotFemaleWave}
        alt="Mascota saludando"
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by Chrome/Edge/Safari
        fetchpriority="high"
      />
      <img
        className="absolute bottom-0 right-0 w-auto max-h-[52vh] animate-mascot-float pointer-events-none select-none z-10"
        src={assets.mascotMaleWave}
        alt="Mascota saludando"
        decoding="async"
        // @ts-expect-error — fetchPriority is supported by Chrome/Edge/Safari
        fetchpriority="high"
      />

      <section
        className="glass-card-smooth relative w-[min(32rem,92vw)] mx-auto my-[7vh] p-8 pt-12 text-center flex flex-col items-center gap-6 animate-card-in z-20"
        aria-label="Ingreso a TYPELY"
      >
        <span
          className="absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(51,199,240,0.22),transparent_60%)] blur-3xl animate-halo-drift pointer-events-none"
          aria-hidden="true"
        />
        <span
          className="absolute -left-4 top-1/3 text-2xl text-accent-sky/50 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✦
        </span>
        <span
          className="absolute -right-4 top-1/2 text-xl text-accent-sky/50 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✦
        </span>
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl text-accent-sky/50 animate-sparkle-spin pointer-events-none select-none"
          aria-hidden="true"
        >
          ✧
        </span>

        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-text mb-1">Bienvenido a TYPELY</h1>
          <p className="text-muted font-semibold">Aprendé a escribir jugando entre las nubes ✨</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 w-full">
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
                className="grid w-9 h-9 place-items-center rounded-full bg-transparent border-0 cursor-pointer text-text/60 hover:text-text transition-colors"
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

          {/* Google sign-in — opens the FedCM "continuar como…" popup. */}
          <button
            type="button"
            className="bg-white flex items-center justify-center gap-2.5 py-3 px-5 rounded-full shadow-md cursor-pointer font-extrabold text-text transition-transform hover:scale-[1.02] active:scale-[0.98] w-full"
            onClick={googleLogin}
          >
            <span className="inline-flex items-center" aria-hidden="true">
              <GoogleGlyph />
            </span>
            Ingresar con Google
          </button>


          <AnimatedButton
            type="button"
            variant="secondary"
            onClick={openDemoModal}
            iconLeft={<Rocket size={19} aria-hidden="true" />}
          >
            Entrar en modo demo
          </AnimatedButton>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted/70 font-semibold mt-1">
            <LockKeyhole size={15} aria-hidden="true" />
            Entorno seguro para aprender y enseñar
          </p>
        </form>
      </section>

      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 animate-overlay-fade"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
        >
          <div className="absolute inset-0" onClick={() => setShowDemoModal(false)} />
          <div className="glass-card-smooth relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col items-center gap-5 animate-menu-reveal">
            <span className="text-4xl" aria-hidden="true"><Rocket size={26} /></span>
            <h2 id="demo-modal-title" className="font-display text-xl font-bold text-text">Modo demo</h2>
            <p className="text-muted text-sm text-center">¿Querés continuar con el progreso anterior o empezar desde cero?</p>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => enterDemo(false)}
              >
                Continuar
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer bg-white/50 text-text transition-transform hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => enterDemo(true)}
              >
                Empezar de cero
              </button>
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setShowDemoModal(false)}
            >
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
