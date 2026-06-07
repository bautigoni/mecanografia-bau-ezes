import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KeyRound, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";
import { api } from "../utils/api";
import { assets } from "../utils/assets";

/* =====================================================================
   "Aceptar invitación" — opened from the email link (/invite/:token).
   Shows who/what the invite is for, then lets the person set a password;
   on success their account is created/activated server-side and they are
   signed in (cross-device, no localStorage).
===================================================================== */
const MIN_LENGTH = 6;

type PublicInvite = { email: string; name?: string | null; role: string; status: string; sedeName?: string };

export function InvitePage() {
  const { token = "" } = useParams();
  const { adoptSession } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getInvitation(token)
      .then((res) => {
        if (alive) setInvite(res.invitation);
      })
      .catch(() => {
        if (alive) setInvite(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (password.length < MIN_LENGTH) {
      setMessage(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await api.acceptInvitation(token, password);
      const active = adoptSession(user);
      navigate(routeForRole(active.role), { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No pudimos aceptar la invitación.");
    } finally {
      setSubmitting(false);
    }
  }

  const invalid = !loading && (!invite || invite.status === "accepted" || invite.status === "expired");
  const roleLabel = invite?.role === "admin-sede" ? "administrador de sede" : "docente";

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center flex items-center justify-center animate-page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      <section
        className="glass-card-smooth relative w-[min(28rem,92vw)] mx-auto my-[7vh] p-8 pt-12 text-center flex flex-col items-center gap-6 animate-card-in z-20"
        aria-label="Aceptar invitación"
      >
        <span
          className="absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgba(51,199,240,0.22),transparent_60%)] blur-3xl animate-halo-drift pointer-events-none"
          aria-hidden="true"
        />
        <div className="text-center flex flex-col items-center gap-2">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-accent-sky to-accent-strong text-white shadow-btn mb-1">
            <MailCheck size={20} />
          </span>
          {loading ? (
            <h1 className="font-display text-2xl font-bold text-text">Cargando invitación…</h1>
          ) : invalid ? (
            <>
              <h1 className="font-display text-2xl font-bold text-text">Invitación no válida</h1>
              <p className="text-muted text-sm">
                {invite?.status === "accepted"
                  ? "Esta invitación ya fue aceptada. Iniciá sesión con tu correo y contraseña."
                  : invite?.status === "expired"
                    ? "Esta invitación expiró. Pedile a tu administrador una nueva."
                    : "No encontramos esta invitación. Pedile a tu administrador que te envíe una nueva."}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-text">¡Te invitaron a TYPELY!</h1>
              <p className="text-muted text-sm">
                Hola{invite?.name ? ` ${invite.name}` : ""} 👋 Vas a unirte
                {invite?.sedeName ? ` a ${invite.sedeName}` : ""} como <strong>{roleLabel}</strong>.
                Creá tu contraseña para empezar.
              </p>
            </>
          )}
        </div>

        {!loading && !invalid && (
          <form onSubmit={submit} className="flex flex-col gap-4 w-full">
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-bold text-text">Tu correo</span>
              <input
                type="email"
                value={invite?.email ?? ""}
                readOnly
                disabled
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 text-muted font-semibold"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-bold text-text">Nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/70 border border-white/60 text-text font-semibold placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-sky/40 focus:bg-white/90 transition-all"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-sm font-bold text-text">Repetir contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Repetí la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/70 border border-white/60 text-text font-semibold placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent-sky/40 focus:bg-white/90 transition-all"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              <Sparkles size={18} /> {submitting ? "Creando cuenta…" : "Crear cuenta y entrar"}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted/70 font-semibold mt-1">
              <ShieldCheck size={15} aria-hidden="true" />
              Tu contraseña no se comparte con nadie
            </p>
          </form>
        )}

        {!loading && invalid && (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <KeyRound size={18} /> Ir a iniciar sesión
          </button>
        )}
      </section>

      <Toast message={message} />
    </main>
  );
}
