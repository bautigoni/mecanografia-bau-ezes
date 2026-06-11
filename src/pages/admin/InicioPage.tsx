import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, GraduationCap, Users, Activity, TrendingUp, Zap, AlertTriangle, Bell,
  CalendarClock,
} from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";
import { relTime } from "./TeachersListPage";
import { useAuth } from "../../hooks/useAuth";
import { api, type AdminOverview } from "../../utils/api";

const EMPTY: AdminOverview = {
  counts: { courses: 0, teachers: 0, students: 0 },
  activeToday: 0, avgProgress: 0, weekly: [], alerts: { inactiveStudents: 0, lowPrecisionStudents: 0, inactiveTeachers: 0, coursesNoTeacher: 0 }, attentionCourses: [], recent: [],
};

const worldLabel = (w: string) => `Mundo ${Number(w.replace("island", "")) || w}`;

export function InicioPage() {
  const navigate = useNavigate();
  const { user, viewAs } = useAuth();
  const siteId = user?.role === "superadmin" && viewAs?.sedeId ? viewAs.sedeId : user?.siteId;
  const [data, setData] = useState<AdminOverview>(EMPTY);

  const load = useCallback(async () => {
    try { setData(await api.adminOverview(siteId ?? undefined)); } catch { /* keep empty */ }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const weeklyTotal = data.weekly.reduce((a, d) => a + d.count, 0);
  const maxDay = Math.max(1, ...data.weekly.map((d) => d.count));
  const a = data.alerts;
  const alertItems = [
    a.inactiveStudents > 0 && { text: `${a.inactiveStudents} alumno(s) sin ingresar hace 7 días`, to: "/admin-sede/alumnos" },
    a.lowPrecisionStudents > 0 && { text: `${a.lowPrecisionStudents} alumno(s) con precisión baja (<60%)`, to: "/admin-sede/alumnos" },
    a.coursesNoTeacher > 0 && { text: `${a.coursesNoTeacher} curso(s) sin docente asignado`, to: "/admin-sede/cursos" },
    a.inactiveTeachers > 0 && { text: `${a.inactiveTeachers} docente(s) sin ingresar hace 14 días`, to: "/admin-sede/docentes" },
  ].filter(Boolean) as { text: string; to: string }[];

  return (
    <SedeShell
      active="inicio"
      hero={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-black text-2xl text-text">Hola, {user?.name ?? "Admin"} 👋</h1>
            <p className="text-muted font-semibold text-sm">Resumen de tu sede.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigate("/admin-sede/docentes")} className="glass-surface px-4 py-2.5 rounded-xl font-bold text-text cursor-pointer">Invitar docente</button>
            <button type="button" onClick={() => navigate("/admin-sede/cursos")} className="px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn cursor-pointer">+ Crear curso</button>
          </div>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={BookOpen} label="Cursos" value={data.counts.courses} tone="text-amber-500" onClick={() => navigate("/admin-sede/cursos")} />
        <Kpi icon={GraduationCap} label="Docentes" value={data.counts.teachers} tone="text-accent-sky" onClick={() => navigate("/admin-sede/docentes")} />
        <Kpi icon={Users} label="Alumnos" value={data.counts.students} tone="text-accent-pink" onClick={() => navigate("/admin-sede/alumnos")} />
        <Kpi icon={Activity} label="Activos hoy" value={data.activeToday} tone="text-mint" />
        <Kpi icon={Zap} label="Sesiones (7d)" value={weeklyTotal} tone="text-accent-strong" />
        <Kpi icon={TrendingUp} label="Progreso prom." value={`${data.avgProgress}%`} tone="text-accent-teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly activity */}
        <section className="glass-card-smooth rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-4"><Activity size={18} /> Actividad de la semana</h2>
          <div className="flex items-end justify-between gap-2 h-40">
            {data.weekly.map((d) => (
              <div key={d.date} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-full flex items-end justify-center h-32">
                  <div className="w-7 rounded-t-lg bg-gradient-to-t from-accent-strong to-accent-sky transition-all" style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }} title={`${d.count} sesiones`} />
                </div>
                <span className="text-xs font-bold text-muted">{d.label}</span>
                <span className="text-[10px] text-muted -mt-1">{d.count}</span>
              </div>
            ))}
            {data.weekly.length === 0 && <p className="text-muted text-sm m-auto">Sin actividad todavía.</p>}
          </div>
        </section>

        {/* Alerts */}
        <section className="glass-card-smooth rounded-2xl p-5">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><Bell size={18} className="text-rose" /> Alertas</h2>
          {alertItems.length === 0 ? (
            <p className="text-muted text-sm">Todo en orden 🎉</p>
          ) : (
            <div className="flex flex-col gap-2">
              {alertItems.map((al, i) => (
                <button key={i} type="button" onClick={() => navigate(al.to)} className="flex items-start gap-2 text-left p-2 rounded-xl hover:bg-white/40 transition cursor-pointer">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold text-text">{al.text}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Attention courses */}
      {data.attentionCourses.length > 0 && (
        <section className="glass-card-smooth rounded-2xl p-5">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><AlertTriangle size={18} className="text-amber-500" /> Cursos que necesitan atención</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.attentionCourses.map((c) => (
              <button key={c.id + c.reason} type="button" onClick={() => navigate(`/admin-sede/curso/${c.id}`)} className="glass-surface rounded-xl p-3 text-left flex items-center gap-3 hover:-translate-y-0.5 transition-transform cursor-pointer">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-amber-200/50 text-amber-700 shrink-0"><BookOpen size={18} /></span>
                <div className="min-w-0">
                  <strong className="text-text text-sm truncate block">{c.name}</strong>
                  <span className="text-xs text-rose font-semibold">{c.reason}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section className="glass-card-smooth rounded-2xl p-5">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><CalendarClock size={18} /> Actividad reciente</h2>
        {data.recent.length === 0 ? (
          <p className="text-muted text-sm">Todavía no hay actividad de alumnos.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/40">
            {data.recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-mint/20 text-mint text-xs font-black shrink-0">{r.studentName.slice(0, 1).toUpperCase()}</span>
                <span className="text-sm text-text flex-1 min-w-0 truncate">
                  <strong>{r.studentName}</strong> {r.completed ? "completó" : "practicó"} <span className="text-muted">{worldLabel(r.worldId)}</span>
                </span>
                <span className="text-xs text-muted shrink-0">{relTime(r.at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </SedeShell>
  );
}

function Kpi({ icon: Icon, label, value, tone, onClick }: { icon: typeof Users; label: string; value: number | string; tone: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`glass-surface rounded-2xl p-3 flex items-center gap-2.5 text-left ${onClick ? "cursor-pointer hover:-translate-y-0.5 transition-transform" : "cursor-default"}`}>
      <span className={`grid place-items-center w-9 h-9 rounded-xl bg-white/60 shrink-0 ${tone}`}><Icon size={18} /></span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-muted text-[10px] font-bold uppercase truncate">{label}</span>
        <strong className="text-text text-lg font-black font-display">{value}</strong>
      </div>
    </button>
  );
}
