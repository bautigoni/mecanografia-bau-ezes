import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, GraduationCap, Users, BookOpen, Plus, Trash2, UserPlus, KeyRound, Check, Layers,
} from "lucide-react";
import { api, type ClassMember, type ApiUser } from "../utils/api";

/* =====================================================================
   Course detail / management (admin-sede + superadmin).

   Everything for ONE class in one place (Matific-style):
   - assign / remove teachers
   - add students one by one OR in bulk (one name per line)
   - enable / disable the level-worlds for the class
   ===================================================================== */

/* The 15 level worlds, in pedagogical order, for per-class enablement. */
const WORLD_OPTIONS: { id: string; label: string }[] = [
  { id: "island1", label: "M1 · Letras" },
  { id: "island2", label: "M2 · Palabras" },
  { id: "island3", label: "M3 · Mayúsculas y tildes" },
  { id: "island4", label: "M4 · Símbolos" },
  { id: "island5", label: "M5 · Mouse y digital" },
  { id: "island6", label: "M6 · Escritura" },
  { id: "island7", label: "M7 · Palabras largas" },
  { id: "island8", label: "M8 · Signos" },
  { id: "island9", label: "M9 · Correos" },
  { id: "island10", label: "M10 · Búsquedas" },
  { id: "island11", label: "M11 · Comandos" },
  { id: "island12", label: "M12 · Ventanas" },
  { id: "island13", label: "M13 · Mensajes" },
  { id: "island14", label: "M14 · Atajos" },
  { id: "island15", label: "M15 · Gran reto" },
];

function slugEmail(name: string): string {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 24);
  return `${slug || "alumno"}.${Math.random().toString(36).slice(2, 6)}@alumno.typely`;
}

export function CourseDetailPage() {
  const { classId = "" } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState<{ id: string; name: string; grade: string; sedeId: string } | null>(null);
  const [teachers, setTeachers] = useState<ClassMember[]>([]);
  const [students, setStudents] = useState<ClassMember[]>([]);
  const [sedeTeachers, setSedeTeachers] = useState<ApiUser[]>([]);
  const [worlds, setWorlds] = useState<string[] | null>(null); // null = all enabled
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [assignId, setAssignId] = useState("");
  const [newPass, setNewPass] = useState<{ id: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [members, w] = await Promise.all([api.classMembers(classId), api.getClassWorlds(classId)]);
      setCls(members.class);
      setTeachers(members.teachers);
      setStudents(members.students);
      setWorlds(w.worldIds);
      const sedeTs = await api.listUsers({ role: "profesor", sedeId: members.class.sedeId });
      setSedeTeachers(sedeTs);
    } catch {
      setMessage("No se pudo cargar el curso.");
    }
  }, [classId]);

  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setMessage(m); window.setTimeout(() => setMessage(""), 2600); };

  /* ---- Teachers ---- */
  const unassignedTeachers = useMemo(
    () => sedeTeachers.filter((t) => !teachers.some((ct) => ct.id === t.id)),
    [sedeTeachers, teachers],
  );
  async function assignTeacher() {
    if (!assignId) return;
    setBusy(true);
    try { await api.assignTeacher(classId, assignId); setAssignId(""); await load(); flash("Docente asignado."); }
    catch { flash("No se pudo asignar."); } finally { setBusy(false); }
  }
  async function removeTeacher(id: string) {
    setBusy(true);
    try { await api.unassignTeacher(classId, id); await load(); flash("Docente quitado."); }
    catch { flash("No se pudo quitar."); } finally { setBusy(false); }
  }

  /* ---- Students ---- */
  async function addStudent(e: FormEvent) {
    e.preventDefault();
    const name = studentName.trim();
    if (!name || !cls) return;
    setBusy(true);
    try {
      const res = await api.createUser({ fullName: name, email: slugEmail(name), role: "alumno", sedeId: cls.sedeId, classId });
      setStudentName("");
      await load();
      if (res.temporaryPassword) setNewPass({ id: res.user.id, password: res.temporaryPassword });
      flash("Alumno agregado.");
    } catch { flash("No se pudo agregar el alumno."); } finally { setBusy(false); }
  }
  async function addBulk() {
    if (!cls) return;
    const names = bulkText.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    let ok = 0;
    for (const name of names) {
      try { await api.createUser({ fullName: name, email: slugEmail(name), role: "alumno", sedeId: cls.sedeId, classId }); ok++; }
      catch { /* skip */ }
    }
    setBulkText("");
    await load();
    flash(`${ok} alumno(s) agregado(s).`);
    setBusy(false);
  }
  async function removeStudent(id: string) {
    setBusy(true);
    try { await api.deleteUser(id); await load(); flash("Alumno eliminado."); }
    catch { flash("No se pudo eliminar."); } finally { setBusy(false); }
  }
  async function resetPass(id: string) {
    setBusy(true);
    try { const r = await api.resetUserPassword(id); setNewPass({ id, password: r.temporaryPassword }); }
    catch { flash("No se pudo resetear."); } finally { setBusy(false); }
  }

  /* ---- Levels (worlds) ---- */
  const enabledSet = useMemo(() => new Set(worlds ?? WORLD_OPTIONS.map((w) => w.id)), [worlds]);
  async function toggleWorld(id: string) {
    const next = new Set(enabledSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    const arr = WORLD_OPTIONS.filter((w) => next.has(w.id)).map((w) => w.id);
    setWorlds(arr);
    try { await api.setClassWorlds(classId, arr); } catch { flash("No se pudo guardar los niveles."); }
  }

  if (!cls) {
    return (
      <main className="min-h-dvh grid place-items-center text-text font-bold">
        {message || "Cargando curso…"}
      </main>
    );
  }

  return (
    <main className="min-h-dvh p-5 sm:p-8 flex flex-col gap-5 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="glass-surface rounded-xl px-3 py-2 flex items-center gap-2 font-bold text-text hover:brightness-105 transition cursor-pointer">
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-mint/20 text-mint"><BookOpen size={22} /></span>
          <div>
            <h1 className="font-display font-black text-2xl text-text leading-tight">{cls.name}</h1>
            <p className="text-muted text-sm font-semibold">{cls.grade} · {students.length} alumnos · {teachers.length} docentes</p>
          </div>
        </div>
      </header>

      {message && (
        <div className="glass-strong rounded-xl px-4 py-2 text-sm font-bold text-accent-strong">{message}</div>
      )}

      {/* Teachers */}
      <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><GraduationCap size={20} /> Docentes</h2>
        <div className="flex flex-wrap gap-2">
          {teachers.length === 0 && <span className="text-muted text-sm">Sin docentes asignados.</span>}
          {teachers.map((t) => (
            <span key={t.id} className="glass-surface rounded-full pl-3 pr-1.5 py-1 flex items-center gap-2 text-sm font-bold text-text">
              {t.fullName}
              <button type="button" onClick={() => removeTeacher(t.id)} disabled={busy} className="w-6 h-6 grid place-items-center rounded-full hover:bg-rose/20 text-rose cursor-pointer" aria-label="Quitar docente">
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className="glass-surface rounded-xl px-3 h-11 text-text font-semibold cursor-pointer min-w-[14rem]">
            <option value="">Elegí un docente…</option>
            {unassignedTeachers.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>)}
          </select>
          <button type="button" onClick={assignTeacher} disabled={busy || !assignId} className="flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">
            <UserPlus size={18} /> Asignar docente
          </button>
        </div>
      </section>

      {/* Students */}
      <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Users size={20} /> Alumnos ({students.length})</h2>

        <form onSubmit={addStudent} className="flex flex-wrap items-center gap-2">
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nombre del alumno" className="glass-surface rounded-xl px-4 h-11 text-text flex-1 min-w-[12rem] outline-none" />
          <button type="submit" disabled={busy} className="flex items-center gap-2 px-4 h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer"><Plus size={18} /> Agregar</button>
        </form>

        {/* Bulk */}
        <details className="glass-surface rounded-xl p-3">
          <summary className="font-bold text-text cursor-pointer text-sm">Agregar muchos a la vez (uno por línea)</summary>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={"Juan Pérez\nMaría Gómez\n…"} className="w-full mt-2 rounded-xl px-3 py-2 bg-white/60 outline-none text-text resize-y" />
          <button type="button" onClick={addBulk} disabled={busy} className="mt-2 flex items-center gap-2 px-4 h-10 rounded-xl font-bold text-white bg-mint shadow-btn disabled:opacity-50 cursor-pointer"><UserPlus size={16} /> Crear todos</button>
        </details>

        {newPass && (
          <div className="glass-surface rounded-xl p-3 flex items-center gap-2 text-sm">
            <KeyRound size={16} className="text-amber-500" />
            <span className="text-text font-bold">Contraseña temporal: <code className="bg-white/70 px-2 py-0.5 rounded">{newPass.password}</code></span>
            <button type="button" onClick={() => setNewPass(null)} className="ml-auto text-muted hover:text-text cursor-pointer font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-col divide-y divide-white/40">
          {students.length === 0 && <span className="text-muted text-sm py-2">Este curso todavía no tiene alumnos.</span>}
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-accent/15 text-accent-strong font-black text-xs shrink-0">{s.fullName.slice(0, 1).toUpperCase()}</span>
              <div className="flex flex-col min-w-0 flex-1">
                <strong className="text-text text-sm font-bold truncate">{s.fullName}</strong>
                <span className="text-muted text-xs truncate">{s.username ?? s.email}</span>
              </div>
              <button type="button" onClick={() => resetPass(s.id)} disabled={busy} className="glass-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:brightness-105 cursor-pointer flex items-center gap-1"><KeyRound size={13} /> Clave</button>
              <button type="button" onClick={() => removeStudent(s.id)} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose/20 text-rose cursor-pointer" aria-label="Eliminar alumno"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Levels / worlds */}
      <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Layers size={20} /> Niveles habilitados</h2>
        <p className="text-muted text-sm">Tocá para habilitar o deshabilitar cada mundo para este curso.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WORLD_OPTIONS.map((w) => {
            const on = enabledSet.has(w.id);
            return (
              <button key={w.id} type="button" onClick={() => toggleWorld(w.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-left transition cursor-pointer ${on ? "bg-mint/20 text-text ring-2 ring-mint/50" : "glass-surface text-muted"}`}>
                <span className={`grid place-items-center w-5 h-5 rounded-md shrink-0 ${on ? "bg-mint text-white" : "bg-white/60"}`}>{on && <Check size={13} />}</span>
                {w.label}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
