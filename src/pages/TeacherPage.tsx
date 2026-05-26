import { BookOpenCheck, ClipboardList, Eye, LogOut, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import { getTeacherStudents } from "../utils/storage";

export function TeacherPage() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState("");
  const students = getTeacherStudents(user);
  const navigate = useNavigate();

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main className="admin-dashboard teacher-dashboard page-fade">
      <header className="admin-hero">
        <div>
          <span>
            <Sparkles size={20} /> EduTic
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
          <span>Actividad sugerida</span>
          <strong>Letra rápida</strong>
        </article>
        <article>
          <ClipboardList size={27} />
          <span>Clase</span>
          <strong>3ro A</strong>
        </article>
      </section>

      <section className="admin-panel admin-panel--wide">
        <div className="admin-panel__heading">
          <div>
            <h2>Mi clase</h2>
            <p>Usuarios, contraseñas y avance básico para acompañar a tus alumnos.</p>
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
                <th>Contraseña</th>
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
                  <td>{student.password}</td>
                  <td>{student.stats?.precision ?? 0}%</td>
                  <td>{student.stats?.speed ?? 0} ppm</td>
                  <td>
                    <Button variant="secondary" onClick={() => setMessage(`${student.name}: ${student.stats?.points ?? 0} puntos.`)}>
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
