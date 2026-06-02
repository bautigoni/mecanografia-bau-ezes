import { useMemo, useState } from "react";
import { BookOpen, GraduationCap, Home, LineChart, Power, PowerOff, TrendingUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { worlds } from "../data/worlds";
import { getEnabledWorldsForClass, getTeacherStudents, updateTeacherWorldSelection } from "../utils/storage";
import { assets } from "../utils/assets";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

export function TeacherPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("inicio");
  const [message, setMessage] = useState("");

  const students = getTeacherStudents(user);
  const classId = user?.classId ?? "clase-3a";
  const allWorldIds = useMemo(() => worlds.map((w) => w.id), []);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(getEnabledWorldsForClass(classId) ?? allWorldIds));

  function toggleWorld(worldId: string) {
    const next = !enabled.has(worldId);
    const updated = updateTeacherWorldSelection(classId, worldId, next, allWorldIds);
    setEnabled(new Set(updated));
    setMessage(next ? "Isla habilitada para la clase." : "Isla deshabilitada para la clase.");
  }
  function leave() {
    logout();
    navigate("/login");
  }

  const enabledWorlds = worlds.filter((w) => enabled.has(w.id));
  const avgPrecision = students.length
    ? Math.round(students.reduce((s, u) => s + (u.stats?.precision ?? 0), 0) / students.length)
    : 0;
  const firstName = (user?.name ?? "Profe").split(" ")[0];

  const kpis = (
    <div className="kpi-grid">
      <KpiCard icon={GraduationCap} label="Mis cursos" value={enabledWorlds.length} tone="violet" onClick={() => setSection("cursos")} />
      <KpiCard icon={BookOpen} label="Islas totales" value={`${enabledWorlds.length} / ${worlds.length}`} tone="green" />
      <KpiCard icon={Users} label="Estudiantes" value={students.length} tone="pink" onClick={() => setSection("estudiantes")} />
      <KpiCard icon={TrendingUp} label="Progreso promedio" value={`${avgPrecision}%`} tone="blue" />
    </div>
  );

  const hero = (
    <>
      <span className="dash-eyebrow"><Home size={18} /> Docente</span>
      <h1>Hola, <span className="grad">{firstName}</span> 👋</h1>
      <p>Gestioná tus cursos, revisá el progreso de tus estudiantes y acompañalos en su aprendizaje.</p>
    </>
  );

  const courseCards = (
    <div className="course-grid">
      {enabledWorlds.map((w) => (
        <div key={w.id} className="course-card">
          <div className="course-card__top">
            <img className="course-card__thumb" src={w.thumbnail} alt="" decoding="async" loading="lazy" />
            <div>
              <strong>{w.title}</strong>
              <span>{w.levels.length} niveles</span>
            </div>
          </div>
          <div className="progress-track"><div className="progress-track__fill" style={{ width: `${avgPrecision}%` }} /></div>
          <span className="kpi-card__trend">{avgPrecision}% progreso de la clase</span>
        </div>
      ))}
    </div>
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
              <div className="dash-section__head"><h2><BookOpen size={20} /> Mis cursos</h2></div>
              {enabledWorlds.length === 0
                ? <div className="empty-state empty-state--compact"><h3>Sin cursos habilitados</h3><p>Activá islas en "Mis cursos".</p></div>
                : courseCards}
            </section>
            <section className="dash-section">
              <div className="dash-section__head"><h2><LineChart size={20} /> Progreso de estudiantes</h2></div>
              {students.length === 0 ? (
                <div className="empty-state empty-state--compact"><h3>Sin estudiantes</h3></div>
              ) : (
                <div>
                  {students.map((s) => (
                    <div key={s.id} className="progress-row">
                      <span className="progress-row__name">{s.name}</span>
                      <div className="progress-track"><div className="progress-track__fill" style={{ width: `${s.stats?.precision ?? 0}%` }} /></div>
                      <span className="progress-row__pct">{s.stats?.precision ?? 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
          <section className="dash-section">
            <div className="dash-tip">
              <img src={assets.mascotFemaleLaptop} alt="" decoding="async" />
              <div className="dash-tip__body">
                <h3>¡Excelente trabajo! 💡</h3>
                <p>Revisar el progreso a diario motiva a tus estudiantes y mejora sus resultados.</p>
                <Button variant="secondary" onClick={() => setSection("cursos")}>Ver mis cursos</Button>
              </div>
            </div>
          </section>
        </>
      )}

      {section === "cursos" && (
        <section className="dash-section">
          <div className="dash-section__head">
            <div><h2><BookOpen size={20} /> Islas de la clase</h2><p>Elegí qué islas pueden ver tus alumnos. Se guarda automáticamente.</p></div>
          </div>
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
                    {isOn ? "Habilitada" : "Deshabilitada"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {section === "estudiantes" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><Users size={20} /> Mis estudiantes</h2><p>Avance básico para acompañar a cada uno.</p></div></div>
          {students.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Sin estudiantes</h3></div>
          ) : (
            <div>
              {students.map((s) => (
                <div key={s.id} className="progress-row">
                  <span className="progress-row__name">{s.name}</span>
                  <div className="progress-track"><div className="progress-track__fill" style={{ width: `${s.stats?.precision ?? 0}%` }} /></div>
                  <span className="progress-row__pct">{s.stats?.precision ?? 0}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
