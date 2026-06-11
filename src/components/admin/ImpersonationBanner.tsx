import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

/* Barra fija superior visible en CUALQUIER pantalla mientras hay una sesión
   de soporte en modo lectura. Muestra a quién se está viendo, quién la inició
   y la cuenta regresiva; al llegar a 0 (o al tocar "Salir") restaura la
   sesión del administrador real. Montada una sola vez en App. */
export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!impersonation) return;
    const tick = () => setRemaining(Math.max(0, Math.round((impersonation.expiresAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [impersonation]);

  useEffect(() => {
    if (impersonation && remaining === 0) {
      void stopImpersonation().then(() => navigate("/login"));
    }
  }, [impersonation, remaining, stopImpersonation, navigate]);

  if (!impersonation) return null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="fixed top-0 inset-x-0 z-[60] flex justify-center px-3 pt-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-2 bg-amber-400/90 backdrop-blur-md text-amber-950 shadow-[0_10px_30px_rgba(180,120,0,0.35)] border border-amber-200/70 max-w-[96vw]">
        <Eye size={18} className="shrink-0" />
        <span className="text-sm font-bold truncate">
          Modo lectura · viendo <strong>{impersonation.targetName}</strong>
          <span className="hidden sm:inline"> · {impersonation.actorName}</span>
        </span>
        <span className="text-sm font-black tabular-nums bg-white/40 rounded-lg px-2 py-0.5">{mm}:{ss}</span>
        <button
          type="button"
          onClick={() => stopImpersonation().then(() => navigate("/login"))}
          className="flex items-center gap-1.5 text-sm font-extrabold rounded-lg px-3 py-1 bg-amber-950 text-amber-50 hover:brightness-110 cursor-pointer transition"
        >
          <LogOut size={15} /> Salir
        </button>
      </div>
    </div>
  );
}
