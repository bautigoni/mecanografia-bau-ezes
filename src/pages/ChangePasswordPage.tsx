import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";
import { assets } from "../utils/assets";

/* =====================================================================
   "Cambiar contraseña" — shown when a user signs in with a temporary
   password (mustChangePassword). They cannot reach any dashboard until
   they choose a new password. The current password is never shown here:
   setting a new one only requires the new value (the temp login already
   proved they hold the temporary credential).
===================================================================== */
const MIN_LENGTH = 6;

export function ChangePasswordPage() {
  const { user, completePasswordChange, logout } = useAuth();
  const navigate = useNavigate();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");

  // No session, or nothing to change → bounce away. (A user without the
  // force-change flag should never sit on this screen.)
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword) return <Navigate to={routeForRole(user.role)} replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_LENGTH) {
      setMessage(`La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    const refreshed = completePasswordChange(next);
    if (!refreshed) {
      setMessage("No pudimos actualizar la contraseña. Probá de nuevo.");
      return;
    }
    navigate(routeForRole(refreshed.role), { replace: true });
  }

  return (
    <main className="login-page page-fade" style={{ backgroundImage: `url("${assets.loginBg}")` }}>
      <section className="login-card change-pass-card" aria-label="Cambiar contraseña">
        <span className="login-card__halo" aria-hidden="true" />
        <div className="login-card__copy">
          <span className="change-pass-card__badge"><KeyRound size={20} /></span>
          <h1>Creá tu contraseña</h1>
          <p>Ingresaste con una clave temporal. Elegí una contraseña nueva para continuar.</p>
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Repetir contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repetí la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          <button type="submit" className="button button--sm change-pass-card__submit">
            <Sparkles size={18} /> Guardar y continuar
          </button>
          <button
            type="button"
            className="change-pass-card__cancel"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            Cancelar y cerrar sesión
          </button>

          <p className="login-card__safety">
            <ShieldCheck size={15} aria-hidden="true" />
            Tu contraseña no se comparte con nadie
          </p>
        </form>
      </section>

      <Toast message={message} />
    </main>
  );
}
