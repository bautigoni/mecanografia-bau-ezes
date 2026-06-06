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

function StatusChip({ student }: { student: EduTicUser }) {
  const st = studentStatus(student);
  return <span className={`tch-chip tch-chip--${st}`}>{STATUS_LABEL[st]}</span>;
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
      <span className="dash-eyebrow"><Home size={18} /> Docente</span>
      <h1>Hola, <span className="grad">{firstName}</span> 👋</h1>
      <p>Entrá a cada curso para ver a tus alumnos, asignar niveles y seguir su progreso.</p>
    </>
  );

  const kpis = (
    <div className="kpi-grid">
      <KpiCard icon={BookOpen} label="Mis cursos" value={classes.length} tone="violet" onClick={() => setSection("cursos")} />
      <KpiCard icon={Users} label="Estudiantes" value={students.length} tone="pink" onClick={() => setSection("estudiantes")} />
      <KpiCard icon={TrendingUp} label="Precisión promedio" value={`${avgPrecision}%`} tone="blue" />
      <KpiCard icon={Sparkles} label="Van volando" value={flying.length} tone="green" />
    </div>
  );

  function PeopleMini({ list, empty }: { list: typeof students; empty: string }) {
    if (list.length === 0) return <div className="empty-state empty-state--compact"><h3>{empty}</h3></div>;
    return (
      <div className="tch-people">
        {list.slice(0, 5).map((s) => (
          <button key={s.id} type="button" className="tch-people__row" onClick={() => navigate(`/profesor/alumno/${s.id}`)}>
            <span className="tch-people__avatar">{s.name.charAt(0).toUpperCase()}</span>
            <span className="tch-people__main">
              <strong>{s.name}</strong>
              <small>{s.className} · {Math.round(s.stats?.precision ?? 0)}% precisión</small>
            </span>
            <ArrowRight size={16} />
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
          <div className="dash-grid-2">
            <section className="dash-section">
              <div className="dash-section__head"><h2>🆘 Necesitan ayuda</h2></div>
              <PeopleMini list={atRisk} empty="Nadie en riesgo por ahora 🎉" />
            </section>
            <section className="dash-section">
              <div className="dash-section__head"><h2>🚀 Van volando</h2></div>
              <PeopleMini list={flying} empty="Todavía sin destacados" />
            </section>
          </div>
          <section className="dash-section">
            <div className="dash-section__head"><div><h2><BookOpen size={20} /> Mis cursos</h2><p>Entrá a un curso para gestionarlo.</p></div></div>
            {classes.length === 0 ? (
              <div className="empty-state empty-state--compact"><h3>Todavía no tenés cursos asignados</h3></div>
            ) : (
              <div className="people-card-grid">
                {classes.map((c) => {
                  const roster = getStudentsInClass(c.id);
                  const avg = roster.length ? Math.round(roster.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / roster.length) : 0;
                  return (
                    <button key={c.id} type="button" className="people-card people-card--button" onClick={() => navigate(`/profesor/curso/${c.id}`)}>
                      <span className="people-card__avatar people-card__avatar--green"><BookOpen size={20} /></span>
                      <div><strong>{c.name}</strong><span>{roster.length} alumnos · {avg}% precisión</span></div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {section === "cursos" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><BookOpen size={20} /> Mis cursos</h2><p>Tocá un curso para ver sus alumnos y asignar niveles.</p></div></div>
          {classes.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Todavía no tenés cursos asignados</h3></div>
          ) : (
            <div className="people-card-grid">
              {classes.map((c) => {
                const roster = getStudentsInClass(c.id);
                const avg = roster.length ? Math.round(roster.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / roster.length) : 0;
                return (
                  <button key={c.id} type="button" className="people-card people-card--button" onClick={() => navigate(`/profesor/curso/${c.id}`)} title="Abrir curso">
                    <span className="people-card__avatar people-card__avatar--green"><BookOpen size={20} /></span>
                    <div><strong>{c.name}</strong><span>{roster.length} alumnos · {avg}% precisión</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {section === "estudiantes" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><Users size={20} /> Mis estudiantes</h2><p>Todos tus alumnos, de todos tus cursos.</p></div></div>
          {students.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Sin estudiantes</h3></div>
          ) : (
            <div className="tch-table">
              {students.map((s) => {
                const pct = Math.round(s.stats?.precision ?? 0);
                return (
                  <div key={s.id} className="tch-table__row">
                    <span className="tch-people__avatar">{s.name.charAt(0).toUpperCase()}</span>
                    <span className="tch-table__name"><strong>{s.name}</strong><small>{s.className}</small></span>
                    <div className="progress-track tch-table__bar"><div className="progress-track__fill" style={{ width: `${pct}%` }} /></div>
                    <span className="tch-table__pct">{pct}%</span>
                    <StatusChip student={s} />
                    <div className="tch-table__actions">
                      <button type="button" className="tch-btn" onClick={() => navigate(`/profesor/alumno/${s.id}`)}>Ver</button>
                      <button type="button" className="tch-btn" onClick={() => resetPw(s)} title="Restablecer contraseña"><KeyRound size={14} /></button>
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
