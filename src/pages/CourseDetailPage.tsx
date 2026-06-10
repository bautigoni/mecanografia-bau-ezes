import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, GraduationCap, Users, BookOpen, Plus, Trash2, UserPlus, KeyRound, Check,
  Layers, Printer, Pencil, ArrowRightLeft, AlertTriangle, TrendingUp, Activity,
} from "lucide-react";
import { DataTable } from "../components/admin/DataTable";
import { relTime } from "./admin/TeachersListPage";
import {
  api, type ClassMember, type ApiUser, type ApiClass, type ClassProgressRow,
} from "../utils/api";

/* ── Level worlds + skill buckets ── */
const WORLD_OPTIONS: { id: string; label: string }[] = [
  { id: "island1", label: "M1 · Letras" }, { id: "island2", label: "M2 · Palabras" },
  { id: "island3", label: "M3 · Mayúsc./tildes" }, { id: "island4", label: "M4 · Símbolos" },
  { id: "island5", label: "M5 · Mouse/digital" }, { id: "island6", label: "M6 · Escritura" },
  { id: "island7", label: "M7 · Palabras largas" }, { id: "island8", label: "M8 · Signos" },
  { id: "island9", label: "M9 · Correos" }, { id: "island10", label: "M10 · Búsquedas" },
  { id: "island11", label: "M11 · Comandos" }, { id: "island12", label: "M12 · Ventanas" },
  { id: "island13", label: "M13 · Mensajes" }, { id: "island14", label: "M14 · Atajos" },
  { id: "island15", label: "M15 · Gran reto" },
];
const SKILLS = {
  escritura: ["island1", "island2", "island3", "island4", "island6", "island7", "island8", "island9", "island10", "island13", "island15"],
  mouse: ["island5", "island12"],
  atajos: ["island11", "island14"],
};
const WORLD_NUM = (w: string | null) => (w ? Number(w.replace("island", "")) || 0 : 0);

function slugEmail(name: string): string {
  const s = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24);
  return `${s || "alumno"}.${Math.random().toString(36).slice(2, 6)}@alumno.typely`;
}

/** Avg accuracy across the worlds of a skill bucket the student has touched. */
function skillScore(row: ClassProgressRow, worlds: string[]): number | null {
  const vals = worlds.map((w) => row.byWorld[w]?.avgAccuracy).filter((v): v is number => typeof v === "number" && v > 0);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
function scoreColor(s: number | null): string {
  if (s === null) return "bg-white/40 text-muted";
  if (s >= 75) return "bg-emerald-300/60 text-emerald-900";
  if (s >= 60) return "bg-amber-200/70 text-amber-900";
  return "bg-rose-300/60 text-rose-900";
}
function riskOf(row: ClassProgressRow): { label: string; cls: string } {
  const inactiveDays = row.lastActivity ? Math.floor((Date.now() - new Date(row.lastActivity).getTime()) / 86400000) : 999;
  if (row.completedLevels === 0 && inactiveDays > 7) return { label: "Alto", cls: "bg-rose-400 text-white" };
  if (row.avgAccuracy && row.avgAccuracy < 60) return { label: "Alto", cls: "bg-rose-400 text-white" };
  if (inactiveDays > 7 || (row.avgAccuracy && row.avgAccuracy < 75)) return { label: "Medio", cls: "bg-amber-400 text-white" };
  return { label: "Bajo", cls: "bg-emerald-400 text-white" };
}

type Tab = "resumen" | "alumnos" | "docentes" | "progreso" | "config";

export function CourseDetailPage() {
  const { classId = "" } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState<{ id: string; name: string; grade: string; sedeId: string } | null>(null);
  const [teachers, setTeachers] = useState<ClassMember[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [progress, setProgress] = useState<ClassProgressRow[]>([]);
  const [sedeTeachers, setSedeTeachers] = useState<ApiUser[]>([]);
  const [allClasses, setAllClasses] = useState<ApiClass[]>([]);
  const [worlds, setWorlds] = useState<string[] | null>(null);
  const [tab, setTab] = useState<Tab>("resumen");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [assignId, setAssignId] = useState("");
  const [newPass, setNewPass] = useState<{ id: string; password: string } | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const [move, setMove] = useState<{ id: string; name: string; to: string } | null>(null);
  const [cfg, setCfg] = useState({ name: "", grade: "" });

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2600); };

  const load = useCallback(async () => {
    try {
      const [members, w, prog] = await Promise.all([api.classMembers(classId), api.getClassWorlds(classId), api.classProgress(classId)]);
      setCls(members.class);
      setCfg({ name: members.class.name, grade: members.class.grade });
      setTeachers(members.teachers);
      setStudents(members.students);
      setWorlds(w.worldIds);
      setProgress(prog.students);
      const [sedeTs, classes] = await Promise.all([api.listUsers({ role: "profesor", sedeId: members.class.sedeId }), api.listClasses(members.class.sedeId)]);
      setSedeTeachers(sedeTs);
      setAllClasses(classes);
    } catch { setMsg("No se pudo cargar el curso."); }
  }, [classId]);
  useEffect(() => { void load(); }, [load]);

  const progById = useMemo(() => new Map(progress.map((p) => [p.id, p])), [progress]);
  const enabledSet = useMemo(() => new Set(worlds ?? WORLD_OPTIONS.map((w) => w.id)), [worlds]);
  const unassignedTeachers = useMemo(() => sedeTeachers.filter((t) => !teachers.some((ct) => ct.id === t.id)), [sedeTeachers, teachers]);

  /* KPIs for Resumen */
  const kpis = useMemo(() => {
    const n = progress.length || 1;
    const avg = Math.round(progress.reduce((a, p) => a + (p.avgAccuracy || 0), 0) / n);
    const activeToday = progress.filter((p) => p.lastActivity && Date.now() - new Date(p.lastActivity).getTime() < 86400000).length;
    const struggling = progress.filter((p) => riskOf(p).label === "Alto");
    return { avg, activeToday, struggling };
  }, [progress]);

  /* ---- Teachers ---- */
  async function assignTeacher() {
    if (!assignId) return; setBusy(true);
    try { await api.assignTeacher(classId, assignId); setAssignId(""); await load(); flash("Docente asignado."); }
    catch { flash("No se pudo asignar."); } finally { setBusy(false); }
  }
  async function removeTeacher(id: string) {
    setBusy(true);
    try { await api.unassignTeacher(classId, id); await load(); } catch { flash("No se pudo quitar."); } finally { setBusy(false); }
  }

  /* ---- Students ---- */
  async function addStudent(e: FormEvent) {
    e.preventDefault(); const name = studentName.trim(); if (!name || !cls) return; setBusy(true);
    try {
      const res = await api.createUser({ fullName: name, email: slugEmail(name), role: "alumno", sedeId: cls.sedeId, classId });
      setStudentName(""); await load();
      if (res.temporaryPassword) setNewPass({ id: res.user.id, password: res.temporaryPassword });
    } catch { flash("No se pudo agregar."); } finally { setBusy(false); }
  }
  async function addBulk() {
    if (!cls) return; const names = bulkText.split("\n").map((n) => n.trim()).filter(Boolean); if (!names.length) return; setBusy(true);
    let ok = 0;
    for (const name of names) { try { await api.createUser({ fullName: name, email: slugEmail(name), role: "alumno", sedeId: cls.sedeId, classId }); ok++; } catch { /* skip */ } }
    setBulkText(""); await load(); flash(`${ok} alumno(s) agregado(s).`); setBusy(false);
  }
  async function removeStudent(id: string) {
    setBusy(true); try { await api.deleteUser(id); await load(); } catch { flash("No se pudo eliminar."); } finally { setBusy(false); }
  }
  async function resetPass(id: string) {
    setBusy(true); try { const r = await api.resetUserPassword(id); setNewPass({ id, password: r.temporaryPassword }); } catch { flash("No se pudo resetear."); } finally { setBusy(false); }
  }
  async function saveEdit(e: FormEvent) {
    e.preventDefault(); if (!edit) return; setBusy(true);
    try { await api.updateUser(edit.id, { fullName: edit.name.trim() }); setEdit(null); await load(); } catch { flash("No se pudo guardar."); } finally { setBusy(false); }
  }
  async function doMove(e: FormEvent) {
    e.preventDefault(); if (!move || !move.to) return; setBusy(true);
    try { await api.assignStudent(move.to, move.id); setMove(null); await load(); flash("Alumno movido."); } catch { flash("No se pudo mover."); } finally { setBusy(false); }
  }

  /* ---- Levels ---- */
  async function toggleWorld(id: string) {
    const next = new Set(enabledSet); if (next.has(id)) next.delete(id); else next.add(id);
    const arr = WORLD_OPTIONS.filter((w) => next.has(w.id)).map((w) => w.id);
    setWorlds(arr); try { await api.setClassWorlds(classId, arr); } catch { flash("No se pudo guardar."); }
  }

  /* ---- Config ---- */
  async function saveCfg(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.updateClass(classId, { name: cfg.name.trim(), grade: cfg.grade }); await load(); flash("Curso actualizado."); } catch { flash("No se pudo guardar."); } finally { setBusy(false); }
  }
  async function deleteCourse() {
    if (!confirm("¿Eliminar el curso? Esta acción no se puede deshacer.")) return;
    try { await api.deleteClass(classId); navigate("/admin-sede/cursos"); } catch { flash("No se pudo eliminar."); }
  }
  /* F6: archive (soft-close) the course. Keeps all the progress and
     rosters, just hides the course from the active lists. A reactivated
     course returns to "active" in the same academic year. */
  async function archiveCourse() {
    if (!confirm("¿Archivar el curso? Se conserva todo el progreso, pero el curso deja de aparecer en las listas activas. Podés reactivarlo desde Configuración → Año lectivo.")) return;
    setBusy(true);
    try {
      await api.archiveClass(classId);
      flash("Curso archivado.");
      await load();
    } catch { flash("No se pudo archivar."); } finally { setBusy(false); }
  }

  /* ---- Print login cards ---- */
  function printCards() {
    const w = window.open("", "_blank", "width=800,height=900"); if (!w) return;
    const cards = students.map((s) => `
      <div style="border:2px dashed #c9b8ff;border-radius:14px;padding:14px 18px;width:230px;font-family:system-ui">
        <div style="font-weight:800;color:#5932d4;font-size:13px">TYPELY · ${cls?.name ?? ""}</div>
        <div style="font-size:18px;font-weight:800;color:#17355f;margin:6px 0">${s.fullName}</div>
        <div style="font-size:13px;color:#17355f">Usuario: <b>${s.username ?? s.email}</b></div>
        <div style="font-size:13px;color:#17355f">Contraseña: <b>______________</b></div>
      </div>`).join("");
    w.document.write(`<html><head><title>Tarjetas de login</title></head><body style="display:flex;flex-wrap:wrap;gap:14px;padding:18px;background:#eef4ff">${cards}</body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  if (!cls) return <main className="min-h-dvh grid place-items-center text-text font-bold">{msg || "Cargando curso…"}</main>;

  const TABS: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" }, { id: "alumnos", label: "Alumnos" },
    { id: "docentes", label: "Docentes" }, { id: "progreso", label: "Progreso" }, { id: "config", label: "Configuración" },
  ];

  return (
    <main className="min-h-dvh p-5 sm:p-8 flex flex-col gap-5 max-w-6xl mx-auto">
      {/* Header + tabs */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => navigate("/admin-sede/cursos")} className="glass-surface rounded-xl px-3 py-2 flex items-center gap-2 font-bold text-text hover:brightness-105 transition cursor-pointer"><ArrowLeft size={18} /> Volver</button>
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-mint/20 text-mint"><BookOpen size={22} /></span>
          <div>
            <h1 className="font-display font-black text-2xl text-text leading-tight">{cls.name}</h1>
            <p className="text-muted text-sm font-semibold">{cls.grade} · {students.length} alumnos · {teachers.length} docentes</p>
          </div>
        </div>
        <nav className="flex gap-1 glass-surface rounded-2xl p-1 w-fit max-w-full overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition cursor-pointer ${tab === t.id ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:text-text"}`}>{t.label}</button>
          ))}
        </nav>
      </header>

      {msg && <div className="glass-strong rounded-xl px-4 py-2 text-sm font-bold text-accent-strong">{msg}</div>}
      {newPass && (
        <div className="glass-strong rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <KeyRound size={16} className="text-amber-500" />
          <span className="font-bold text-text">Contraseña temporal: <code className="bg-white/70 px-2 py-0.5 rounded">{newPass.password}</code></span>
          <button type="button" onClick={() => setNewPass(null)} className="ml-auto text-muted hover:text-text cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* RESUMEN */}
      {tab === "resumen" && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi icon={TrendingUp} label="Progreso prom." value={`${kpis.avg}%`} tone="text-accent-strong" />
            <Kpi icon={Activity} label="Activos hoy" value={kpis.activeToday} tone="text-mint" />
            <Kpi icon={Users} label="Alumnos" value={students.length} tone="text-accent-sky" />
            <Kpi icon={AlertTriangle} label="En riesgo" value={kpis.struggling.length} tone="text-rose" />
          </div>
          <section className="glass-card-smooth rounded-2xl p-5">
            <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-rose" /> Alumnos con dificultades</h2>
            {kpis.struggling.length === 0 ? <p className="text-muted text-sm">Nadie en riesgo por ahora 🎉</p> : (
              <div className="flex flex-col divide-y divide-white/40">
                {kpis.struggling.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2">
                    <strong className="text-text text-sm flex-1 truncate">{p.fullName}</strong>
                    <span className="text-xs text-muted">Precisión {p.avgAccuracy}% · {p.completedLevels} niveles</span>
                    <span className="text-xs text-muted">{relTime(p.lastActivity)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ALUMNOS */}
      {tab === "alumnos" && (
        <div className="grid gap-4">
          <div className="glass-card-smooth rounded-2xl p-4 flex flex-col gap-3">
            <form onSubmit={addStudent} className="flex flex-wrap items-center gap-2">
              <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nombre del alumno" className="glass-surface rounded-xl px-4 h-11 text-text flex-1 min-w-[12rem] outline-none" />
              <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer"><Plus size={18} /> Agregar</button>
              <button type="button" onClick={printCards} className="flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-text glass-surface cursor-pointer"><Printer size={17} /> Tarjetas de login</button>
            </form>
            <details className="glass-surface rounded-xl p-3">
              <summary className="font-bold text-text cursor-pointer text-sm">Carga masiva (un nombre por línea)</summary>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"Juan Pérez\nMaría Gómez\n…"} className="w-full mt-2 rounded-xl px-3 py-2 bg-white/60 outline-none text-text resize-y" />
              <button type="button" onClick={addBulk} disabled={busy} className="mt-2 flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-white bg-mint shadow-btn disabled:opacity-50 cursor-pointer"><UserPlus size={16} /> Crear todos</button>
            </details>
          </div>

          <DataTable
            rows={students}
            getKey={(s) => s.id}
            columns={[
              { key: "fullName", header: "Nombre", render: (s) => <strong className="font-bold text-text">{s.fullName}</strong> },
              { key: "username", header: "Usuario", render: (s) => <span className="text-muted">{s.username ?? s.email}</span> },
              { key: "last", header: "Última conexión", render: (s) => relTime(s.lastLoginAt) },
              { key: "world", header: "Mundo", render: (s) => { const p = progById.get(s.id); return p?.currentWorld ? `M${WORLD_NUM(p.currentWorld)}` : "—"; } },
              { key: "prog", header: "Niveles", render: (s) => progById.get(s.id)?.completedLevels ?? 0 },
              { key: "estado", header: "Estado", render: (s) => { const p = progById.get(s.id); const r = p ? riskOf(p) : { label: "—", cls: "bg-white/40 text-muted" }; return <span className={`px-2 py-0.5 rounded-full text-xs font-black ${r.cls}`}>{r.label}</span>; } },
            ]}
            actions={(s) => (
              <div className="flex items-center gap-1.5 justify-end">
                <button type="button" onClick={() => setEdit({ id: s.id, name: s.fullName })} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/60 text-text cursor-pointer" aria-label="Editar"><Pencil size={15} /></button>
                <button type="button" onClick={() => setMove({ id: s.id, name: s.fullName, to: "" })} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/60 text-text cursor-pointer" aria-label="Mover"><ArrowRightLeft size={15} /></button>
                <button type="button" onClick={() => resetPass(s.id)} className="glass-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:brightness-105 cursor-pointer flex items-center gap-1"><KeyRound size={13} /> Clave</button>
                <button type="button" onClick={() => removeStudent(s.id)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose/20 text-rose cursor-pointer" aria-label="Eliminar"><Trash2 size={15} /></button>
              </div>
            )}
            empty="Este curso todavía no tiene alumnos."
          />
        </div>
      )}

      {/* DOCENTES */}
      {tab === "docentes" && (
        <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {teachers.length === 0 && <span className="text-muted text-sm">Sin docentes asignados.</span>}
            {teachers.map((t) => (
              <span key={t.id} className="glass-surface rounded-full pl-3 pr-1.5 py-1 flex items-center gap-2 text-sm font-bold text-text">
                {t.fullName} <span className="text-xs text-muted font-normal">· {relTime(t.lastLoginAt)}</span>
                <button type="button" onClick={() => removeTeacher(t.id)} className="w-6 h-6 grid place-items-center rounded-full hover:bg-rose/20 text-rose cursor-pointer" aria-label="Quitar"><Trash2 size={14} /></button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className="glass-surface rounded-xl px-3 h-11 text-text font-semibold cursor-pointer min-w-[14rem]">
              <option value="">Elegí un docente…</option>
              {unassignedTeachers.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>)}
            </select>
            <button type="button" onClick={assignTeacher} disabled={busy || !assignId} className="flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer"><UserPlus size={18} /> Asignar docente</button>
          </div>
        </section>
      )}

      {/* PROGRESO (heatmap) */}
      {tab === "progreso" && (
        <DataTable
          rows={progress}
          getKey={(p) => p.id}
          columns={[
            { key: "fullName", header: "Alumno", render: (p) => <strong className="font-bold text-text">{p.fullName}</strong> },
            { key: "escritura", header: "Escritura", render: (p) => <Cell s={skillScore(p, SKILLS.escritura)} /> },
            { key: "mouse", header: "Mouse", render: (p) => <Cell s={skillScore(p, SKILLS.mouse)} /> },
            { key: "atajos", header: "Atajos", render: (p) => <Cell s={skillScore(p, SKILLS.atajos)} /> },
            { key: "mundo", header: "Mundo actual", render: (p) => (p.currentWorld ? `M${WORLD_NUM(p.currentWorld)}` : "—") },
            { key: "riesgo", header: "Riesgo", render: (p) => { const r = riskOf(p); return <span className={`px-2 py-0.5 rounded-full text-xs font-black ${r.cls}`}>{r.label}</span>; } },
          ]}
          empty="Todavía no hay datos de juego en este curso."
        />
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="grid gap-4 max-w-lg">
          <form onSubmit={saveCfg} className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-display font-extrabold text-lg text-text">Datos del curso</h2>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Nombre
              <input value={cfg.name} onChange={(e) => setCfg((c) => ({ ...c, name: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Grado
              <select value={cfg.grade} onChange={(e) => setCfg((c) => ({ ...c, grade: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold cursor-pointer">
                {["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">Guardar</button>
          </form>
          <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Layers size={18} /> Niveles habilitados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WORLD_OPTIONS.map((w) => {
                const on = enabledSet.has(w.id);
                return (
                  <button key={w.id} type="button" onClick={() => toggleWorld(w.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-left transition cursor-pointer ${on ? "bg-mint/20 text-text ring-2 ring-mint/50" : "glass-surface text-muted"}`}>
                    <span className={`grid place-items-center w-5 h-5 rounded-md shrink-0 ${on ? "bg-mint text-white" : "bg-white/60"}`}>{on && <Check size={13} />}</span>{w.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-2 border border-rose/20">
            <h2 className="font-display font-extrabold text-lg text-rose">Zona peligrosa</h2>
            {/* F6: archive the course individually (preserves history). */}
            <button
              type="button"
              onClick={archiveCourse}
              disabled={busy}
              className="self-start flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-amber-500 shadow-btn disabled:opacity-50 cursor-pointer"
              title="Archivar: conserva todo el progreso, oculta el curso de las listas activas."
            >
              <Layers size={18} /> Archivar curso
            </button>
            <button type="button" onClick={deleteCourse} className="self-start flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-rose shadow-btn cursor-pointer"><Trash2 size={18} /> Eliminar curso</button>
          </section>
        </div>
      )}

      {/* Edit modal */}
      {edit && (
        <Modal onClose={() => setEdit(null)} title="Editar alumno">
          <form onSubmit={saveEdit} className="flex flex-col gap-3">
            <input autoFocus value={edit.name} onChange={(e) => setEdit((x) => x && { ...x, name: e.target.value })} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            <button type="submit" disabled={busy} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn cursor-pointer">Guardar</button>
          </form>
        </Modal>
      )}
      {/* Move modal */}
      {move && (
        <Modal onClose={() => setMove(null)} title={`Mover a ${move.name}`}>
          <form onSubmit={doMove} className="flex flex-col gap-3">
            <select value={move.to} onChange={(e) => setMove((x) => x && { ...x, to: e.target.value })} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold cursor-pointer">
              <option value="">Elegí el curso destino…</option>
              {allClasses.filter((c) => c.id !== classId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="submit" disabled={busy || !move.to} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">Mover</button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number | string; tone: string }) {
  return (
    <div className="glass-surface rounded-2xl p-4 flex items-center gap-3">
      <span className={`grid place-items-center w-10 h-10 rounded-xl bg-white/60 ${tone}`}><Icon size={20} /></span>
      <div className="flex flex-col leading-tight">
        <span className="text-muted text-xs font-bold uppercase">{label}</span>
        <strong className="text-text text-xl font-black font-display">{value}</strong>
      </div>
    </div>
  );
}

function Cell({ s }: { s: number | null }) {
  return <span className={`inline-grid place-items-center min-w-[2.6rem] px-2 py-1 rounded-lg text-xs font-black ${scoreColor(s)}`}>{s === null ? "—" : `${s}%`}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade" role="dialog" aria-modal="true">
      <div className="modal-overlay" onClick={onClose} />
      <div className="glass-card-smooth modal-card relative z-10 p-6 w-[min(24rem,92vw)] flex flex-col gap-4 animate-card-pop">
        <h2 className="font-display font-bold text-xl text-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}
