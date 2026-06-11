import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Users, CalendarClock, Mail, CheckCircle2, Target } from "lucide-react";
import { relTime } from "./TeachersListPage";
import { api, type TeacherDetail } from "../../utils/api";

const worldLabel = (w: string) => `Mundo ${Number(w.replace("island", "")) || w}`;

export function TeacherDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<TeacherDetail | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setD(await api.teacherDetail(id)); } catch { setErr("No se pudo cargar el docente."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!d) return <main className="min-h-dvh grid place-items-center text-text font-bold">{err || "Cargando…"}</main>;
  const { teacher, classes, stats, recent } = d;

  return (
    <main className="min-h-dvh p-5 sm:p-8 flex flex-col gap-5 max-w-5xl mx-auto">
      <button type="button" onClick={() => navigate("/admin-sede/docentes")} className="self-start glass-surface rounded-xl px-3 py-2 flex items-center gap-2 font-bold text-text hover:brightness-105 transition cursor-pointer"><ArrowLeft size={18} /> Volver</button>

      {/* Header */}
      <section className="glass-card-smooth rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5">
        <span className="grid place-items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-mint to-accent-teal text-white font-black text-3xl shrink-0">{teacher.fullName.slice(0, 1).toUpperCase()}</span>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-display font-black text-2xl text-text">{teacher.fullName}</h1>
          <p className="text-muted font-semibold flex items-center justify-center sm:justify-start gap-1.5"><Mail size={15} /> {teacher.email}</p>
          <p className="text-sm text-muted mt-1">Último ingreso: <b>{relTime(teacher.lastLoginAt)}</b></p>
        </div>
        <div className="flex gap-3">
          <div className="text-center glass-surface rounded-2xl px-5 py-3"><div className="font-display font-black text-2xl text-text">{stats.classCount}</div><span className="text-xs text-muted font-bold uppercase">Cursos</span></div>
          <div className="text-center glass-surface rounded-2xl px-5 py-3"><div className="font-display font-black text-2xl text-text">{stats.studentCount}</div><span className="text-xs text-muted font-bold uppercase">Alumnos</span></div>
        </div>
      </section>

      {/* Assigned classes */}
      <section className="glass-card-smooth rounded-2xl p-5">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><BookOpen size={18} /> Cursos asignados</h2>
        {classes.length === 0 ? <p className="text-muted text-sm">No tiene cursos asignados.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {classes.map((c) => (
              <button key={c.id} type="button" onClick={() => navigate(`/admin-sede/curso/${c.id}`)} className="glass-surface rounded-xl p-3 text-left flex items-center gap-3 hover:-translate-y-0.5 transition-transform cursor-pointer">
                <span className="grid place-items-center w-10 h-10 rounded-lg bg-mint/20 text-mint shrink-0"><BookOpen size={20} /></span>
                <div className="min-w-0">
                  <strong className="text-text text-sm truncate block">{c.name}</strong>
                  <span className="text-xs text-muted flex items-center gap-1"><Users size={12} /> {c.studentCount} · {c.grade}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity of their students */}
      <section className="glass-card-smooth rounded-2xl p-5">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><CalendarClock size={18} /> Actividad de sus alumnos</h2>
        {recent.length === 0 ? <p className="text-muted text-sm">Sin actividad reciente.</p> : (
          <div className="flex flex-col divide-y divide-white/40">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${r.completed ? "bg-mint/20 text-mint" : "bg-amber-200/50 text-amber-700"}`}>{r.completed ? <CheckCircle2 size={16} /> : <Target size={16} />}</span>
                <span className="flex-1 min-w-0 text-text truncate"><strong>{r.studentName}</strong> {r.completed ? "completó" : "practicó"} <span className="text-muted">{worldLabel(r.worldId)}</span></span>
                <span className="text-xs text-muted shrink-0">{relTime(r.at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
