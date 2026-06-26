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

/* Tailwind tone map for stat cards (replaces kpi-card--{tone}). */
const statToneCls: Record<string, string> = {
  blue: "border-l-4 border-l-accent-sky",
  violet: "border-l-4 border-l-accent",
  green: "border-l-4 border-l-mint",
  gold: "border-l-4 border-l-yellow-400",
  pink: "border-l-4 border-l-accent-pink",
};

/* Student-status chip styles (replaces tch-chip--{st}). */
const chipCls: Record<string, string> = {
  flying: "bg-mint/20 text-accent-teal",
  atRisk: "bg-rose/20 text-rose",
  idle: "bg-white/40 text-muted",
  neutral: "bg-accent-sky/20 text-accent-sky",
};

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
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <Users size={18} /> Alumno · {course.name}
      </span>
      <h1 className="font-display text-3xl font-bold text-text">{student.name}</h1>
      <p className="text-muted font-semibold flex items-center gap-2 flex-wrap">
        {student.email ?? student.username} ·{" "}
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${chipCls[st]}`}>
          {STATUS_LABEL[st]}
        </span>
      </p>
      <div className="flex flex-wrap gap-3 mt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-text/70 hover:text-text cursor-pointer bg-transparent border-0 transition-colors"
          onClick={() => navigate(`/profesor/curso/${course.id}`)}
        >
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
      {/* Stat cards grid (replaces tch-stat-grid + kpi-card) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <article key={c.label} className={`glass-card p-4 flex items-center gap-3 ${statToneCls[c.tone]}`}>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent/10 text-accent shrink-0">
              <c.icon size={24} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted uppercase tracking-wide">{c.label}</span>
              <strong className="text-xl font-display font-bold text-text">{c.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <Users size={20} /> Datos del alumno
            </h2>
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p><strong>Curso:</strong> {course.name}</p>
          <p><strong>Usuario:</strong> {student.username}</p>
          {student.email && <p><strong>Email:</strong> {student.email}</p>}
          <p><strong>Estado:</strong> {STATUS_LABEL[st]}</p>
        </div>
        <p className="text-sm text-muted font-semibold mt-1.5 animate-soft-hint-in">
          El historial detallado por nivel e intentos estará disponible cuando se conecte el backend.
        </p>
      </section>

      <section className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <KeyRound size={20} /> Acceso
            </h2>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-[2.75rem] px-4 gap-1.5 rounded-xl font-bold cursor-pointer transition-all duration-180 ease hover:-translate-y-0.5 active:scale-[0.985] bg-accent text-white shadow-btn hover:shadow-btn-hover self-start"
          onClick={resetPw}
        >
          <KeyRound size={16} /> Restablecer contraseña
        </button>
        {tempPw && (
          <p className="text-xs font-semibold text-accent-teal bg-accent-teal/10 px-3 py-1.5 rounded-lg mt-1.5">
            Clave temporal: <strong>{student.username} / {tempPw}</strong> — compartila una sola vez; el alumno la cambia al ingresar.
          </p>
        )}
      </section>

      <Toast message={message} />
    </DashboardShell>
  );
}
