import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  GraduationCap,
  Gamepad2,
  ShieldCheck,
  Wrench,
  Move,
  Droplet,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { api, type ApiSede } from "../utils/api";
import { routeForRole } from "../utils/storage";
import { assets } from "../utils/assets";

/* =====================================================================
   "¿Cómo querés entrar?" — superadmin god-mode chooser.

   Only a superadmin reaches this screen (LoginPage routes them here).
   They keep their full-authority superadmin token; choosing a role/sede
   just decides which surface to render via the `viewAs` context. Any
   other role is bounced straight to their own dashboard.
===================================================================== */
export function EntrarPage() {
  const { user, setViewAs } = useAuth();
  const navigate = useNavigate();
  const [sedes, setSedes] = useState<ApiSede[]>([]);
  const [sedeId, setSedeId] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "superadmin") {
      navigate(routeForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let alive = true;
    api
      .listSedes()
      .then((rows) => {
        if (!alive) return;
        setSedes(rows);
        if (rows[0]) setSedeId(rows[0].id);
      })
      .catch(() => { /* offline — sede options simply won't be selectable */ });
    return () => { alive = false; };
  }, []);

  const sedeName = useMemo(
    () => sedes.find((s) => s.id === sedeId)?.name ?? "",
    [sedes, sedeId],
  );

  function enterSuperadmin() {
    setViewAs(null);
    navigate("/admin-general");
  }
  function enterAsSede() {
    if (!sedeId) return;
    setViewAs({ role: "admin-sede", sedeId });
    navigate("/admin-sede");
  }
  function enterAsTeacher() {
    if (!sedeId) return;
    setViewAs({ role: "profesor", sedeId });
    navigate("/profesor");
  }
  function enterGame() {
    setViewAs({ role: "alumno" });
    navigate("/mundos");
  }
  function enterDev() {
    setViewAs({ role: "alumno", dev: true });
    navigate("/mundos");
  }

  const needsSede = sedes.length > 0;

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-cover bg-center flex items-center justify-center p-4 animate-page-fade"
      style={{ backgroundImage: `url("${assets.loginBg}")` }}
    >
      <section className="glass-card-smooth relative w-[min(46rem,94vw)] my-[6vh] p-8 flex flex-col gap-6 animate-card-in z-20">
        <header className="text-center">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-strong uppercase tracking-wide">
            <Crown size={18} /> Superadmin
          </span>
          <h1 className="font-display text-3xl font-bold text-text mt-1">¿Cómo querés entrar?</h1>
          <p className="text-muted font-semibold">
            Tenés acceso total. Elegí el panel, o entrá como cualquier rol de la sede que quieras.
          </p>
        </header>

        {/* Sede selector — shared by the sede-scoped options. */}
        {needsSede && (
          <label className="glass-surface flex items-center gap-3 rounded-xl px-4 h-12">
            <span className="text-sm font-bold text-muted shrink-0">Sede:</span>
            <select
              className="bg-transparent outline-none text-text font-bold w-full cursor-pointer"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChoiceCard
            icon={Crown}
            title="Panel Superadmin"
            subtitle="Sedes y administradores de todo el ecosistema."
            onClick={enterSuperadmin}
          />
          <ChoiceCard
            icon={ShieldCheck}
            title="Admin de sede"
            subtitle={sedeName ? `Gestionar ${sedeName}.` : "Gestionar una sede."}
            disabled={needsSede && !sedeId}
            onClick={enterAsSede}
          />
          <ChoiceCard
            icon={GraduationCap}
            title="Docente"
            subtitle={sedeName ? `Vista de profesor en ${sedeName}.` : "Vista de profesor."}
            disabled={needsSede && !sedeId}
            onClick={enterAsTeacher}
          />
          <ChoiceCard
            icon={Gamepad2}
            title="Modo juego"
            subtitle="Entrar al mapa de mundos como un alumno."
            onClick={enterGame}
          />
          <ChoiceCard
            icon={Wrench}
            title="Modo desarrollador"
            subtitle="Editor de posiciones de niveles activado."
            onClick={enterDev}
          />
          <ChoiceCard
            icon={Move}
            title="Editor de login"
            subtitle="Mover los robots del login y copiar sus posiciones."
            onClick={() => navigate("/editor-login")}
          />
          <ChoiceCard
            icon={Droplet}
            title="Editor liquid-glass"
            subtitle="Ajustar blur, saturación y transparencia del glass."
            onClick={() => navigate("/editor-glass")}
          />
        </div>
      </section>
    </main>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: typeof Crown;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="glass-surface group flex items-center gap-3 p-4 rounded-xl text-left border-0 w-full transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent-strong shrink-0">
        <Icon size={22} />
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <strong className="text-text font-extrabold">{title}</strong>
        <span className="text-xs text-muted truncate">{subtitle}</span>
      </span>
      <ArrowRight size={18} className="text-muted shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}
