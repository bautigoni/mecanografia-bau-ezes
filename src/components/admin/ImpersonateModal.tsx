import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ShieldAlert, X } from "lucide-react";
import { api, ApiError, type ApiActiveUser } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { routeForRole } from "../../utils/storage";

/* Modal de TRIPLE verificación para entrar a una cuenta en MODO LECTURA
   (soporte avalado legalmente, 30 min). Los tres factores:
     1) re-ingreso de la propia contraseña del administrador,
     2) frase de confirmación exacta,
     3) aceptación explícita del aviso legal.
   El backend vuelve a validar los tres y emite un token de solo lectura. */

const CONFIRM_PHRASE = "ACCEDER EN MODO LECTURA";

export function ImpersonateModal({
  target,
  onClose,
}: {
  target: { id: string; name: string };
  onClose: () => void;
}) {
  const { startImpersonation } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ready = password.length > 0 && phrase.trim() === CONFIRM_PHRASE && ack;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.impersonate({ userId: target.id, password, confirmPhrase: phrase.trim(), legalAck: true });
      const au = startImpersonation(res.access, res.user as ApiActiveUser, res.actor.name, res.expiresInSeconds);
      onClose();
      navigate(routeForRole(au.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar el modo lectura.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade" role="dialog" aria-modal="true" aria-labelledby="imp-title">
      <div className="modal-overlay" onClick={onClose} />
      <form onSubmit={submit} className="glass-card-smooth modal-card relative max-h-[90vh] overflow-y-auto p-7 w-[min(30rem,94vw)] flex flex-col gap-4 animate-card-pop">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-white/40 text-text/60 hover:text-text cursor-pointer" aria-label="Cerrar"><X size={16} /></button>
        <span className="grid place-items-center w-12 h-12 rounded-full bg-amber-200/50 text-amber-700" aria-hidden="true"><Eye size={24} /></span>
        <div>
          <h2 id="imp-title" className="font-display text-xl font-bold text-text">Entrar en modo lectura</h2>
          <p className="text-muted font-semibold text-sm mt-1">
            Vas a ver la cuenta de <strong className="text-text">{target.name}</strong> durante 30 minutos, <strong>sin poder modificar nada</strong>.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-amber-100/60 border border-amber-300/60 px-3 py-2.5 text-xs text-amber-900 font-semibold">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>Acceso de soporte registrado en auditoría. Usalo solo cuando esté legalmente justificado: el titular puede solicitar el registro de estos accesos.</span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
          1 · Tu contraseña
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold"
            placeholder="Reingresá tu contraseña"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
          2 · Escribí <code className="bg-white/60 px-1.5 py-0.5 rounded text-accent-strong">{CONFIRM_PHRASE}</code>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold uppercase tracking-wide"
            placeholder={CONFIRM_PHRASE}
          />
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-text">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="w-5 h-5 rounded-md accent-accent-teal mt-0.5 cursor-pointer" />
          3 · Declaro que este acceso está justificado y autorizado, y entiendo que queda registrado.
        </label>

        {error && <p className="text-rose font-bold text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!ready || busy}
          className="h-11 rounded-xl font-extrabold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.98]"
        >
          {busy ? "Verificando…" : "Entrar en modo lectura"}
        </button>
      </form>
    </div>
  );
}
