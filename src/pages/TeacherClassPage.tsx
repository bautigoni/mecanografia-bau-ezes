import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, Home, KeyRound, Power, PowerOff, Users } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { worlds } from "../data/worlds";
import {
  getClassesForTeacher,
  getEnabledWorldsForClass,
  getStudentsInClass,
  resetUserPassword,
  updateTeacherWorldSelection,
} from "../utils/storage";
import { STATUS_LABEL, studentStatus } from "../utils/studentStatus";
import { assets } from "../utils/assets";
import type { EduTicUser } from "../types";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

export function TeacherClassPage() {
  const { classId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  /* Scope: a teacher can only open a class they teach. */
  const classes = useMemo(() => getClassesForTeacher(user), [user]);
  const course = classes.find((c) => c.id === classId);

  const students = useMemo(
    () => (classId ? getStudentsInClass(classId) : []),
    [classId, version],
  );

  const allWorldIds = useMemo(() => worlds.map((w) => w.id), []);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(getEnabledWorldsForClass(classId) ?? allWorldIds),
  );

  if (!course) return <Navigate to="/profesor" replace />;

  const avg = students.length
    ? Math.round(students.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / students.length)
    : 0;

  function leave() {
    void logout();
    navigate("/login");
  }
  function toggleWorld(worldId: string) {
    if (!classId) return;
    const next = !enabled.has(worldId);
    const updated = updateTeacherWorldSelection(classId, worldId, next, allWorldIds);
    setEnabled(new Set(updated));
    setMessage(next ? "Nivel habilitado para el curso." : "Nivel deshabilitado para el curso.");
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
      <span className="dash-eyebrow"><BookOpen size={18} /> Curso</span>
      <h1>{course.name}</h1>
      <p>{students.length} alumnos · {enabled.size}/{worlds.length} niveles habilitados.</p>
      <div className="dash-hero__actions">
        <button type="button" className="tch-back" onClick={() => navigate("/profesor")}>
          <ArrowLeft size={18} /> Volver a mis cursos
        </button>
      </div>
    </>
  );

  return (
    <DashboardShell
      accent="blue"
      roleLabel="DOCENTE"
      roleSubtitle={user?.name ?? "Docente"}
      roleIcon={GraduationCap}
      account={{ name: user?.name ?? "Docente", email: user?.email ?? "docente@typely.com", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId="cursos"
      onNavigate={() => navigate("/profesor")}
      onLogout={leave}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      <div className="kpi-grid">
        <KpiCard icon={Users} label="Alumnos" value={students.length} tone="pink" />
        <KpiCard icon={BookOpen} label="Niveles habilitados" value={`${enabled.size}/${worlds.length}`} tone="violet" />
        <KpiCard icon={GraduationCap} label="Precisión promedio" value={`${avg}%`} tone="blue" />
      </div>

      <section className="dash-section">
        <div className="dash-section__head"><div><h2><Users size={20} /> Alumnos del curso</h2><p>Tocá un alumno para ver su detalle.</p></div></div>
        {students.length === 0 ? (
          <div className="empty-state empty-state--compact"><h3>Este curso todavía no tiene alumnos</h3></div>
        ) : (
          <div className="tch-table">
            {students.map((s) => {
              const pct = Math.round(s.stats?.precision ?? 0);
              const st = studentStatus(s);
              return (
                <div key={s.id} className="tch-table__row">
                  <span className="tch-people__avatar">{s.name.charAt(0).toUpperCase()}</span>
                  <span className="tch-table__name"><strong>{s.name}</strong><small>{s.username}</small></span>
                  <div className="progress-track tch-table__bar"><div className="progress-track__fill" style={{ width: `${pct}%` }} /></div>
                  <span className="tch-table__pct">{pct}%</span>
                  <span className={`tch-chip tch-chip--${st}`}>{STATUS_LABEL[st]}</span>
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

      <section className="dash-section">
        <div className="dash-section__head"><div><h2><BookOpen size={20} /> Niveles a asignar</h2><p>Elegí qué niveles puede ver y jugar este curso. Se guarda automáticamente.</p></div></div>
        <div className="island-toggle-grid">
          {worlds.map((world) => {
            const isOn = enabled.has(world.id);
            return (
              <article key={world.id} className={`island-toggle-card ${isOn ? "is-on" : "is-off"}`}>
                <div className="island-toggle-card__thumb">
                  <img src={world.thumbnail} alt="" decoding="async" loading="lazy" />
                  <span className="island-toggle-card__order">#{world.order}</span>
                </div>
                <div className="island-toggle-card__body">
                  <strong>{world.title}</strong>
                  <span className="island-toggle-card__topic">{world.topic}</span>
                  <span className="island-toggle-card__meta">{world.levels.length} niveles</span>
                </div>
                <button
                  type="button"
                  className={`island-toggle-card__switch ${isOn ? "is-on" : "is-off"}`}
                  onClick={() => toggleWorld(world.id)}
                  aria-pressed={isOn}
                >
                  {isOn ? <Power size={16} /> : <PowerOff size={16} />}
                  {isOn ? "Habilitado" : "Deshabilitado"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <Toast message={message} />
    </DashboardShell>
  );
}
