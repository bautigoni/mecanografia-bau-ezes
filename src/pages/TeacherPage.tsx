import { BookOpenCheck, ClipboardList, Eye, LogOut, Power, PowerOff, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { worlds } from "../data/worlds";
import {
  getEnabledWorldsForClass,
  getTeacherStudents,
  updateTeacherWorldSelection,
} from "../utils/storage";

export function TeacherPage() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState("");
  const students = getTeacherStudents(user);
  const navigate = useNavigate();

  /* The class this teacher manages (superadmin manages the demo class). */
  const classId = user?.classId ?? "clase-3a";
  const allWorldIds = useMemo(() => worlds.map((w) => w.id), []);

  /* Local enabled-set state, seeded from persistence.
     null in storage → every world enabled. */
  const [enabled, setEnabled] = useState<Set<string>>(() => {
    const saved = getEnabledWorldsForClass(classId);
    return new Set(saved ?? allWorldIds);
  });

  function toggleWorld(worldId: string) {
    const next = !enabled.has(worldId);
    const updated = updateTeacherWorldSelection(classId, worldId, next, allWorldIds);
    setEnabled(new Set(updated));
    setMessage(
      next
        ? "Isla habilitada para la clase."
        : "Isla deshabilitada para la clase.",
    );
  }

  function leave() {
    logout();
    navigate("/login");
  }

  const enabledCount = worlds.filter((w) => enabled.has(w.id)).length;

  return (
    <main className="admin-dashboard teacher-dashboard page-fade">
      <header className="admin-hero">
        <div>
          <span>
            <Sparkles size={20} /> TYPELY
          </span>
          <h1>Panel docente</h1>
          <p>Seguimiento simple de tu clase, credenciales y actividades asignadas.</p>
        </div>
        <Button variant="ghost" onClick={leave}>
          <LogOut size={19} />
          Salir
        </Button>
      </header>

      <section className="dashboard-stat-grid">
        <article>
          <Users size={27} />
          <span>Alumnos</span>
          <strong>{students.length}</strong>
        </article>
        <article>
          <BookOpenCheck size={27} />
          <span>Islas habilitadas</span>
          <strong>{enabledCount} / {worlds.length}</strong>
        </article>
        <article>
          <ClipboardList size={27} />
          <span>Clase</span>
          <strong>3ro A</strong>
        </article>
      </section>

      {/* ── Island selection ── */}
      <section className="admin-panel admin-panel--wide">
        <div className="admin-panel__heading">
          <div>
            <h2>Islas de la clase</h2>
            <p>Elegí qué islas pueden ver tus alumnos. Los cambios se guardan automáticamente.</p>
          </div>
        </div>

        <div className="island-toggle-grid">
          {worlds.map((world) => {
            const isOn = enabled.has(world.id);
            return (
              <article
                key={world.id}
                className={`island-toggle-card ${isOn ? "is-on" : "is-off"}`}
              >
                <div className="island-toggle-card__thumb">
                  <img src={world.thumbnail} alt="" decoding="async" loading="lazy" />
                  <span className="island-toggle-card__order">#{world.order}</span>
                </div>
                <div className="island-toggle-card__body">
                  <strong>{world.title}</strong>
                  <span className="island-toggle-card__topic">{world.topic}</span>
                  <span className="island-toggle-card__meta">
                    {world.levels.length} niveles · Dificultad {world.order}
                  </span>
                </div>
                <button
                  type="button"
                  className={`island-toggle-card__switch ${isOn ? "is-on" : "is-off"}`}
                  onClick={() => toggleWorld(world.id)}
                  aria-pressed={isOn}
                  aria-label={isOn ? `Deshabilitar ${world.title}` : `Habilitar ${world.title}`}
                >
                  {isOn ? <Power size={16} /> : <PowerOff size={16} />}
                  {isOn ? "Habilitada" : "Deshabilitada"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Class roster ── */}
      <section className="admin-panel admin-panel--wide">
        <div className="admin-panel__heading">
          <div>
            <h2>Mi clase</h2>
            <p>Usuarios y avance básico para acompañar a tus alumnos.</p>
          </div>
          <Button onClick={() => setMessage("Actividad asignada a la clase.")}>
            <ClipboardList size={18} />
            Asignar actividad
          </Button>
        </div>
        <div className="modern-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Usuario</th>
                <th>Precisión</th>
                <th>Velocidad</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.username}</td>
                  <td>{student.stats?.precision ?? 0}%</td>
                  <td>{student.stats?.speed ?? 0} ppm</td>
                  <td>
                    <Button
                      variant="secondary"
                      onClick={() => setMessage(`${student.name}: ${student.stats?.points ?? 0} puntos.`)}
                    >
                      <Eye size={17} />
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Toast message={message} />
    </main>
  );
}
