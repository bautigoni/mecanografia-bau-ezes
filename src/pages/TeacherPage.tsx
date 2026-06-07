import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Home,
  KeyRound,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { getClassesForTeacher, getStudentsInClass, resetUserPassword } from "../utils/storage";
import { STATUS_LABEL, studentStatus } from "../utils/studentStatus";
import { assets } from "../utils/assets";
import type { EduTicUser } from "../types";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

/* Student-status chip styles (replaces tch-chip--{st}). */
const chipCls: Record<string, string> = {
  flying: "bg-mint/20 text-accent-teal",
  atRisk: "bg-rose/20 text-rose",
  idle: "bg-white/40 text-muted",
  neutral: "bg-accent-sky/20 text-accent-sky",
};

function StatusChip({ student }: { student: EduTicUser }) {
  const st = studentStatus(student);
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${chipCls[st]}`}>
      {STATUS_LABEL[st]}
    </span>
  );
}

export function TeacherPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("inicio");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const classes = useMemo(() => getClassesForTeacher(user), [user, version]);

  /* Every student across the teacher's classes (de-duplicated), tagged with
     their course name. Pure localStorage — the per-attempt history would need
     the backend. */
  const students = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<EduTicUser & { className: string; classId: string }> = [];
    for (const c of classes) {
      for (const s of getStudentsInClass(c.id)) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        list.push({ ...s, className: c.name, classId: c.id });
      }
    }
    return list;
  }, [classes, version]);

  const avgPrecision = students.length
    ? Math.round(students.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / students.length)
    : 0;
  const atRisk = students.filter((s) => studentStatus(s) === "atRisk");
  const flying = students.filter((s) => studentStatus(s) === "flying");
  const firstName = (user?.name ?? "Profe").split(" ")[0];

  function leave() {
    void logout();
    navigate("/login");
  }
  function resetPw(s: EduTicUser) {
    const pw = resetUserPassword(s.id);
    if (pw) {
      setMessage(`Clave temporal de ${s.name}: ${s.username} / ${pw}`);
      setVersion((v) => v + 1);
    }
  }

  const hero = (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <Home size={18} /> Docente
      </span>
      <h1 className="font-display text-3xl font-bold text-text">
        Hola, <span className="bg-gradient-to-r from-accent-sky via-accent to-accent-pink bg-clip-text text-transparent">{firstName}</span> 👋
      </h1>
      <p className="text-muted font-semibold">Entrá a cada curso para ver a tus alumnos, asignar niveles y seguir su progreso.</p>
    </>
  );

  const kpis = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard icon={BookOpen} label="Mis cursos" value={classes.length} tone="violet" onClick={() => setSection("cursos")} />
      <KpiCard icon={Users} label="Estudiantes" value={students.length} tone="pink" onClick={() => setSection("estudiantes")} />
      <KpiCard icon={TrendingUp} label="Precisión promedio" value={`${avgPrecision}%`} tone="blue" />
      <KpiCard icon={Sparkles} label="Van volando" value={flying.length} tone="green" />
    </div>
  );

  function PeopleMini({ list, empty }: { list: typeof students; empty: string }) {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
          <h3 className="font-display text-lg font-bold text-text">{empty}</h3>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        {list.slice(0, 5).map((s) => (
          <button
            key={s.id}
            type="button"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/30 cursor-pointer transition-colors border-0 bg-transparent text-left w-full"
            onClick={() => navigate(`/profesor/alumno/${s.id}`)}
          >
            <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/15 text-accent font-bold text-sm shrink-0">
              {s.name.charAt(0).toUpperCase()}
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <strong className="text-sm text-text truncate">{s.name}</strong>
              <small className="text-xs text-muted truncate">{s.className} · {Math.round(s.stats?.precision ?? 0)}% precisión</small>
            </span>
            <ArrowRight size={16} className="text-muted shrink-0" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <DashboardShell
      accent="blue"
      roleLabel="DOCENTE"
      roleSubtitle={user?.name ?? "Docente"}
      roleIcon={GraduationCap}
      account={{ name: user?.name ?? "Docente", email: user?.email ?? "docente@typely.com", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId={section}
      onNavigate={setSection}
      onLogout={leave}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      {section === "inicio" && (
        <>
          {kpis}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-bold text-text">🆘 Necesitan ayuda</h2>
              </div>
              <PeopleMini list={atRisk} empty="Nadie en riesgo por ahora 🎉" />
            </section>
            <section className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-bold text-text">🚀 Van volando</h2>
              </div>
              <PeopleMini list={flying} empty="Todavía sin destacados" />
            </section>
          </div>
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                  <BookOpen size={20} /> Mis cursos
                </h2>
                <p className="text-sm text-muted font-semibold">Entrá a un curso para gestionarlo.</p>
              </div>
            </div>
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
                <h3 className="font-display text-lg font-bold text-text">Todavía no tenés cursos asignados</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {classes.map((c) => {
                  const roster = getStudentsInClass(c.id);
                  const avg = roster.length ? Math.round(roster.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / roster.length) : 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="glass-surface flex items-center gap-3 p-4 animate-card-in cursor-pointer border-0 text-left w-full hover:-translate-y-0.5 transition-transform"
                      onClick={() => navigate(`/profesor/curso/${c.id}`)}
                    >
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-mint/20 text-accent-teal shrink-0">
                        <BookOpen size={20} />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <strong className="text-sm text-text truncate">{c.name}</strong>
                        <span className="text-xs text-muted truncate">{roster.length} alumnos · {avg}% precisión</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {section === "cursos" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <BookOpen size={20} /> Mis cursos
              </h2>
              <p className="text-sm text-muted font-semibold">Tocá un curso para ver sus alumnos y asignar niveles.</p>
            </div>
          </div>
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
              <h3 className="font-display text-lg font-bold text-text">Todavía no tenés cursos asignados</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {classes.map((c) => {
                const roster = getStudentsInClass(c.id);
                const avg = roster.length ? Math.round(roster.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / roster.length) : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="glass-surface flex items-center gap-3 p-4 animate-card-in cursor-pointer border-0 text-left w-full hover:-translate-y-0.5 transition-transform"
                    onClick={() => navigate(`/profesor/curso/${c.id}`)}
                    title="Abrir curso"
                  >
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-mint/20 text-accent-teal shrink-0">
                      <BookOpen size={20} />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <strong className="text-sm text-text truncate">{c.name}</strong>
                      <span className="text-xs text-muted truncate">{roster.length} alumnos · {avg}% precisión</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {section === "estudiantes" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <Users size={20} /> Mis estudiantes
              </h2>
              <p className="text-sm text-muted font-semibold">Todos tus alumnos, de todos tus cursos.</p>
            </div>
          </div>
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
              <h3 className="font-display text-lg font-bold text-text">Sin estudiantes</h3>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {students.map((s) => {
                const pct = Math.round(s.stats?.precision ?? 0);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40">
                    <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/15 text-accent font-bold text-sm shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex flex-col min-w-0 w-32 shrink-0">
                      <strong className="text-sm text-text truncate">{s.name}</strong>
                      <small className="text-xs text-muted truncate">{s.className}</small>
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-white/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-teal transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-muted w-12 text-right">{pct}%</span>
                    <StatusChip student={s} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-white/50 text-text hover:bg-white/70 border-0 transition-colors"
                        onClick={() => navigate(`/profesor/alumno/${s.id}`)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-white/50 text-text hover:bg-white/70 border-0 transition-colors"
                        onClick={() => resetPw(s)}
                        title="Restablecer contraseña"
                      >
                        <KeyRound size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
