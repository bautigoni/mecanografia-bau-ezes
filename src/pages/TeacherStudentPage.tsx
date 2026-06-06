import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Gauge,
  GraduationCap,
  Home,
  KeyRound,
  Star,
  Target,
  Users,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Toast } from "../components/common/Toast";
import { DashboardShell, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { getClassesForTeacher, getUserById, resetUserPassword } from "../utils/storage";
import { STATUS_LABEL, studentStatus } from "../utils/studentStatus";
import { assets } from "../utils/assets";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

export function TeacherStudentPage() {
  const { studentId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [tempPw, setTempPw] = useState("");

  const classes = useMemo(() => getClassesForTeacher(user), [user]);
  const student = useMemo(() => getUserById(studentId), [studentId]);
  const course = classes.find((c) => student && c.studentIds.includes(student.id));

  // Scope: the student must exist, be an alumno, and belong to one of this
  // teacher's classes.
  if (!student || student.role !== "alumno" || !course) {
    return <Navigate to="/profesor" replace />;
  }

  const stats = student.stats ?? { precision: 0, speed: 0, completedLevels: 0, points: 0 };
  const st = studentStatus(student);

  function leave() {
    void logout();
    navigate("/login");
  }
  function resetPw() {
    const pw = resetUserPassword(student!.id);
    if (pw) {
      setTempPw(pw);
      setMessage(`Contraseña restablecida para ${student!.name}.`);
    }
  }

  const hero = (
    <>
      <span className="dash-eyebrow"><Users size={18} /> Alumno · {course.name}</span>
      <h1>{student.name}</h1>
      <p>{student.email ?? student.username} · <span className={`tch-chip tch-chip--${st}`}>{STATUS_LABEL[st]}</span></p>
      <div className="dash-hero__actions">
        <button type="button" className="tch-back" onClick={() => navigate(`/profesor/curso/${course.id}`)}>
          <ArrowLeft size={18} /> Volver al curso
        </button>
      </div>
    </>
  );

  const cards = [
    { icon: Target, label: "Precisión", value: `${Math.round(stats.precision)}%`, tone: "blue" },
    { icon: Gauge, label: "Velocidad", value: `${Math.round(stats.speed)} ppm`, tone: "violet" },
    { icon: CheckCircle2, label: "Niveles completados", value: stats.completedLevels, tone: "green" },
    { icon: Star, label: "Estrellas", value: stats.points, tone: "gold" },
  ] as const;

  return (
    <DashboardShell
      accent="blue"
      roleLabel="DOCENTE"
      roleSubtitle={user?.name ?? "Docente"}
      roleIcon={GraduationCap}
      account={{ name: user?.name ?? "Docente", email: user?.email ?? "docente@typely.com", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId="estudiantes"
      onNavigate={() => navigate("/profesor")}
      onLogout={leave}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      <div className="tch-stat-grid">
        {cards.map((c) => (
          <article key={c.label} className={`kpi-card kpi-card--${c.tone}`}>
            <span className="kpi-card__icon"><c.icon size={24} /></span>
            <div className="kpi-card__body">
              <span className="kpi-card__label">{c.label}</span>
              <strong className="kpi-card__value">{c.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="dash-section">
        <div className="dash-section__head"><div><h2><Users size={20} /> Datos del alumno</h2></div></div>
        <div className="tch-detail">
          <p><strong>Curso:</strong> {course.name}</p>
          <p><strong>Usuario:</strong> {student.username}</p>
          {student.email && <p><strong>Email:</strong> {student.email}</p>}
          <p><strong>Estado:</strong> {STATUS_LABEL[st]}</p>
        </div>
        <p className="dash-hint" style={{ marginTop: "0.6rem" }}>
          El historial detallado por nivel e intentos estará disponible cuando se conecte el backend.
        </p>
      </section>

      <section className="dash-section">
        <div className="dash-section__head"><div><h2><KeyRound size={20} /> Acceso</h2></div></div>
        <button type="button" className="tch-btn tch-btn--primary" onClick={resetPw}>
          <KeyRound size={16} /> Restablecer contraseña
        </button>
        {tempPw && (
          <p className="course-student__pass" style={{ marginTop: "0.6rem" }}>
            Clave temporal: <strong>{student.username} / {tempPw}</strong> — compartila una sola vez; el alumno la cambia al ingresar.
          </p>
        )}
      </section>

      <Toast message={message} />
    </DashboardShell>
  );
}
