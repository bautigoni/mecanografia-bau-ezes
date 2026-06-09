import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Flame, Star, Zap, Clock, Target, CheckCircle2, ThumbsUp, AlertTriangle, CalendarClock,
} from "lucide-react";
import { relTime } from "./TeachersListPage";
import { api, type StudentDetail } from "../../utils/api";

const SKILLS: Record<string, string[]> = {
  Escritura: ["island1", "island2", "island3", "island4", "island6", "island7", "island8", "island9", "island10", "island13", "island15"],
  Mouse: ["island5", "island12"],
  Atajos: ["island11", "island14"],
};
const worldNum = (w: string | null) => (w ? Number(w.replace("island", "")) || 0 : 0);
const worldLabel = (w: string) => `Mundo ${worldNum(w)}`;
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function StudentDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setD(await api.studentDetail(id)); } catch { setErr("No se pudo cargar el alumno."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!d) return <main className="min-h-dvh grid place-items-center text-text font-bold">{err || "Cargando…"}</main>;
  const { student, stats, byWorld, timeline } = d;

  const skillAvgs = Object.entries(SKILLS).map(([name, ws]) => {
    const vals = byWorld.filter((b) => ws.includes(b.worldId) && b.avgAccuracy > 0).map((b) => b.avgAccuracy);
    return { name, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });
  const rated = skillAvgs.filter((s) => s.avg !== null) as { name: string; avg: number }[];
  const strongest = rated.length ? rated.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const weakest = rated.length ? rated.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

  return (
    <main className="min-h-dvh p-5 sm:p-8 flex flex-col gap-5 max-w-5xl mx-auto">
      <button type="button" onClick={() => navigate("/admin-sede/alumnos")} className="self-start glass-surface rounded-xl px-3 py-2 flex items-center gap-2 font-bold text-text hover:brightness-105 transition cursor-pointer"><ArrowLeft size={18} /> Volver</button>

      {/* Hero (Duolingo-style) */}
      <section className="glass-card-smooth rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5">
        <span className="grid place-items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-sky to-accent-strong text-white font-black text-3xl shrink-0">{student.fullName.slice(0, 1).toUpperCase()}</span>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="font-display font-black text-2xl text-text">{student.fullName}</h1>
          <p className="text-muted font-semibold">{student.className ?? "Sin curso"} · {student.username ?? student.email}</p>
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-amber-500"><Star size={16} fill="currentColor" /> {stats.stars} estrellas</span>
            <span className="flex items-center gap-1 text-orange-500"><Flame size={16} /> {stats.streakDays} días</span>
            <span className="flex items-center gap-1 text-accent-strong"><Zap size={16} /> {stats.xp} XP</span>
          </div>
        </div>
        <div className="text-center glass-surface rounded-2xl px-5 py-3">
          <span className="text-xs font-bold text-muted uppercase">Mundo actual</span>
          <div className="font-display font-black text-2xl text-text">{stats.currentWorld ? `M${worldNum(stats.currentWorld)}` : "—"}</div>
          <span className="text-xs text-muted">Nivel {stats.currentLevel || "—"}</span>
        </div>
      </section>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile icon={Clock} label="Tiempo de uso" value={fmtTime(stats.totalSeconds)} />
        <Tile icon={CheckCircle2} label="Niveles completados" value={stats.completedLevels} />
        <Tile icon={Target} label="Precisión prom." value={`${stats.avgAccuracy}%`} />
        <Tile icon={Zap} label="Actividades" value={stats.totalAttempts} />
      </div>

      {/* Strengths / weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section className="glass-card-smooth rounded-2xl p-5">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><ThumbsUp size={18} className="text-mint" /> Fortalezas y debilidades</h2>
          {rated.length === 0 ? <p className="text-muted text-sm">Todavía sin datos suficientes.</p> : (
            <div className="flex flex-col gap-2">
              {skillAvgs.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-bold text-text shrink-0">{s.name}</span>
                  <div className="flex-1 h-3 rounded-full bg-white/50 overflow-hidden">
                    <div className={`h-full rounded-full ${s.avg === null ? "" : s.avg >= 75 ? "bg-emerald-400" : s.avg >= 60 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${s.avg ?? 0}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-bold text-muted">{s.avg === null ? "—" : `${s.avg}%`}</span>
                </div>
              ))}
              <p className="text-xs text-muted mt-1">
                {strongest && <span className="text-mint font-bold">Fuerte en {strongest.name}. </span>}
                {weakest && weakest.name !== strongest?.name && <span className="text-rose font-bold">A reforzar: {weakest.name}.</span>}
              </p>
            </div>
          )}
        </section>

        <section className="glass-card-smooth rounded-2xl p-5">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><AlertTriangle size={18} className="text-amber-500" /> Mundos con más errores</h2>
          {byWorld.length === 0 ? <p className="text-muted text-sm">Sin datos.</p> : (
            <div className="flex flex-col gap-1.5">
              {[...byWorld].sort((a, b) => a.avgAccuracy - b.avgAccuracy).slice(0, 4).map((w) => (
                <div key={w.worldId} className="flex items-center justify-between text-sm">
                  <span className="text-text font-bold">{worldLabel(w.worldId)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${w.avgAccuracy >= 75 ? "bg-emerald-300/60 text-emerald-900" : w.avgAccuracy >= 60 ? "bg-amber-200/70 text-amber-900" : "bg-rose-300/60 text-rose-900"}`}>{w.avgAccuracy}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="glass-card-smooth rounded-2xl p-5">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-3"><CalendarClock size={18} /> Actividad reciente</h2>
        {timeline.length === 0 ? <p className="text-muted text-sm">Todavía no jugó.</p> : (
          <div className="flex flex-col divide-y divide-white/40">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                <span className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${t.completed ? "bg-mint/20 text-mint" : "bg-amber-200/50 text-amber-700"}`}>{t.completed ? <CheckCircle2 size={16} /> : <Target size={16} />}</span>
                <span className="flex-1 min-w-0 text-text"><strong>{worldLabel(t.worldId)}</strong> · Nivel {t.levelNumber} <span className="text-muted">· {t.accuracy}% · {t.errorCount} errores</span></span>
                <span className="text-xs text-muted shrink-0">{relTime(t.at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Tile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number | string }) {
  return (
    <div className="glass-surface rounded-2xl p-4 flex items-center gap-3">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/60 text-accent-strong"><Icon size={20} /></span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-muted text-[10px] font-bold uppercase truncate">{label}</span>
        <strong className="text-text text-lg font-black font-display">{value}</strong>
      </div>
    </div>
  );
}
