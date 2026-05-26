import { FormEvent, useMemo, useState } from "react";
import { BookOpen, GraduationCap, KeyRound, LogOut, Plus, School, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { useAuth } from "../hooks/useAuth";
import type { ClassRoom, EduTicUser } from "../types";
import { addUserToClass, createCredentials, getDemoData, makeId, patchDemoData } from "../utils/storage";

type Tab = "Alumnos" | "Docentes" | "Clases" | "Credenciales";

const tabs: Array<{ id: Tab; icon: typeof Users }> = [
  { id: "Alumnos", icon: Users },
  { id: "Docentes", icon: GraduationCap },
  { id: "Clases", icon: School },
  { id: "Credenciales", icon: KeyRound },
];

export function SiteAdminPage() {
  const [data, setData] = useState(() => getDemoData());
  const [tab, setTab] = useState<Tab>("Alumnos");
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [className, setClassName] = useState("");
  const [selectedClass, setSelectedClass] = useState(data.classes[0]?.id ?? "");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [message, setMessage] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const siteClasses = useMemo(
    () => data.classes.filter((classRoom) => classRoom.siteId === user?.siteId),
    [data.classes, user?.siteId],
  );
  const students = data.users.filter((item) => item.role === "alumno" && item.siteId === user?.siteId);
  const teachers = data.users.filter((item) => item.role === "profesor" && item.siteId === user?.siteId);

  function refresh(toast: string) {
    const next = getDemoData();
    setData(next);
    setMessage(toast);
  }

  function createStudent(event: FormEvent) {
    event.preventDefault();
    const credentials = createCredentials(studentName);
    const student: EduTicUser = {
      id: makeId("student"),
      name: studentName,
      username: credentials.username,
      password: credentials.password,
      role: "alumno",
      siteId: user?.siteId,
      classId: selectedClass,
      stats: { precision: 0, speed: 0, completedLevels: 0, points: 0 },
    };
    addUserToClass(student, selectedClass);
    setStudentName("");
    refresh(`Alumno creado: ${student.username} / ${student.password}`);
  }

  function createTeacher(event: FormEvent) {
    event.preventDefault();
    const credentials = createCredentials(teacherName);
    const teacher: EduTicUser = {
      id: makeId("teacher"),
      name: teacherName,
      username: credentials.username,
      password: credentials.password,
      role: "profesor",
      siteId: user?.siteId,
      classId: selectedClass,
    };
    addUserToClass(teacher, selectedClass);
    setTeacherName("");
    refresh(`Docente creado: ${teacher.username} / ${teacher.password}`);
  }

  function createClass(event: FormEvent) {
    event.preventDefault();
    const nextClass: ClassRoom = {
      id: makeId("class"),
      name: className,
      siteId: user?.siteId ?? "sede-norte",
      teacherIds: [],
      studentIds: [],
    };
    patchDemoData({ ...data, classes: [...data.classes, nextClass] });
    setClassName("");
    refresh("Clase creada.");
  }

  function assign(kind: "student" | "teacher") {
    const targetId = kind === "student" ? selectedStudent : selectedTeacher;
    if (!targetId || !selectedClass) {
      setMessage("Elegí una persona y una clase para asignar.");
      return;
    }

    const classes = data.classes.map((classRoom) => {
      if (classRoom.id !== selectedClass) return classRoom;
      return kind === "student"
        ? { ...classRoom, studentIds: Array.from(new Set([...classRoom.studentIds, targetId])) }
        : { ...classRoom, teacherIds: Array.from(new Set([...classRoom.teacherIds, targetId])) };
    });
    const users = data.users.map((item) => (item.id === targetId ? { ...item, classId: selectedClass } : item));
    patchDemoData({ ...data, classes, users });
    refresh("Asignación guardada.");
  }

  function regenerateStudentPassword() {
    if (!selectedStudent) {
      setMessage("Elegí un alumno para generar credenciales.");
      return;
    }

    const users = data.users.map((item) =>
      item.id === selectedStudent ? { ...item, ...createCredentials(item.name) } : item,
    );
    patchDemoData({ ...data, users });
    refresh("Credenciales generadas para el alumno.");
  }

  function leave() {
    logout();
    navigate("/login");
  }

  return (
    <main className="admin-dashboard page-fade">
      <header className="admin-hero">
        <div>
          <span>
            <Sparkles size={20} /> EduTic
          </span>
          <h1>Panel de sede</h1>
          <p>Organizá alumnos, docentes, clases y credenciales de la sede.</p>
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
          <GraduationCap size={27} />
          <span>Docentes</span>
          <strong>{teachers.length}</strong>
        </article>
        <article>
          <BookOpen size={27} />
          <span>Clases</span>
          <strong>{siteClasses.length}</strong>
        </article>
      </section>

      <nav className="dashboard-tabs" aria-label="Secciones de sede">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
              <Icon size={18} />
              {item.id}
            </button>
          );
        })}
      </nav>

      <section className="admin-grid">
        {tab === "Alumnos" && (
          <article className="admin-panel">
            <h2>Crear alumno</h2>
            <form className="admin-form" onSubmit={createStudent}>
              <input required placeholder="Nombre del alumno" value={studentName} onChange={(event) => setStudentName(event.target.value)} />
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                {siteClasses.map((classRoom) => (
                  <option key={classRoom.id} value={classRoom.id}>
                    {classRoom.name}
                  </option>
                ))}
              </select>
              <Button>
                <Plus size={18} /> Crear alumno
              </Button>
            </form>
          </article>
        )}

        {tab === "Docentes" && (
          <article className="admin-panel">
            <h2>Crear docente</h2>
            <form className="admin-form" onSubmit={createTeacher}>
              <input required placeholder="Nombre del docente" value={teacherName} onChange={(event) => setTeacherName(event.target.value)} />
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                {siteClasses.map((classRoom) => (
                  <option key={classRoom.id} value={classRoom.id}>
                    {classRoom.name}
                  </option>
                ))}
              </select>
              <Button>
                <Plus size={18} /> Crear docente
              </Button>
            </form>
          </article>
        )}

        {tab === "Clases" && (
          <article className="admin-panel">
            <h2>Crear clase</h2>
            <form className="admin-form" onSubmit={createClass}>
              <input required placeholder="Nombre de la clase" value={className} onChange={(event) => setClassName(event.target.value)} />
              <Button>
                <Plus size={18} /> Crear clase
              </Button>
            </form>
          </article>
        )}

        {tab === "Credenciales" && (
          <article className="admin-panel admin-panel--wide">
            <h2>Asignaciones y credenciales</h2>
            <div className="credential-tools">
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
                {siteClasses.map((classRoom) => (
                  <option key={classRoom.id} value={classRoom.id}>
                    {classRoom.name}
                  </option>
                ))}
              </select>
              <select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)}>
                <option value="">Elegir alumno</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => assign("student")}>Asignar alumno</Button>
              <select value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>
                <option value="">Elegir docente</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => assign("teacher")}>Asignar docente</Button>
              <Button variant="secondary" onClick={regenerateStudentPassword}>
                Generar usuario y contraseña
              </Button>
            </div>
          </article>
        )}
      </section>
      <Toast message={message} />
    </main>
  );
}
