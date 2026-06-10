import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, KeyRound, Trash2, Pencil } from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";
import { DataTable } from "../../components/admin/DataTable";
import { relTime } from "./TeachersListPage";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import { useAuth } from "../../hooks/useAuth";
import { api, type ApiUser, type ApiClass } from "../../utils/api";

function slugEmail(name: string): string {
  const s = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 20);
  return `${s || "alumno"}.${Math.random().toString(36).slice(2, 6)}@alumno.typely`;
}

export function StudentsListPage() {
  const navigate = useNavigate();
  const { user, viewAs } = useAuth();
  const siteId = user?.role === "superadmin" && viewAs?.sedeId ? viewAs.sedeId : user?.siteId;
  const { selected: selectedYear } = useAcademicYear();

  const [students, setStudents] = useState<ApiUser[]>([]);
  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", classId: "" });
  const [edit, setEdit] = useState<{ id: string; name: string; username: string; classId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState<{ id: string; password: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.listUsers({ role: "alumno", sedeId: siteId ?? undefined }), api.listClasses(siteId, true)]);
      setStudents(s);
      setClasses(c);
    } catch { setMsg("No se pudieron cargar los alumnos."); }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const classYearByClassId = useMemo(() => new Map(classes.map((c) => [c.id, c.academicYearId ?? null])), [classes]);
  // F6: filter by selected year (through the student's class).
  const yearClassIds = useMemo(() => {
    if (!selectedYear) return new Set<string>();
    // Los cursos sin año asignado cuentan como del año vigente.
    return new Set(classes.filter((c) => c.academicYearId === selectedYear.id || !c.academicYearId).map((c) => c.id));
  }, [classes, selectedYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !(s.fullName.toLowerCase().includes(q) || (s.username ?? "").toLowerCase().includes(q))) return false;
      if (courseFilter && s.classId !== courseFilter) return false;
      // Los alumnos SIN curso se muestran siempre ("Sin curso") — antes el
      // filtro por año los escondía y un alumno recién creado "desaparecía".
      if (selectedYear && s.classId && !yearClassIds.has(s.classId)) return false;
      return true;
    });
  }, [students, search, courseFilter, selectedYear, yearClassIds]);

  async function createStudent(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const res = await api.createUser({ fullName: draft.name.trim(), email: slugEmail(draft.name), role: "alumno", sedeId: siteId, classId: draft.classId || null });
      if (res.temporaryPassword) setPass({ id: res.user.id, password: res.temporaryPassword });
      setCreating(false);
      setDraft({ name: "", classId: "" });
      await load();
    } catch { setMsg("No se pudo crear el alumno."); } finally { setBusy(false); }
  }
  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api.updateUser(edit.id, {
        fullName: edit.name.trim(),
        username: edit.username.trim() || undefined,
        classId: edit.classId || null,
      });
      setEdit(null);
      await load();
    } catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  async function resetPass(id: string) {
    setBusy(true);
    try { const r = await api.resetUserPassword(id); setPass({ id, password: r.temporaryPassword }); }
    catch { setMsg("No se pudo resetear."); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await api.deleteUser(id); await load(); } catch { setMsg("No se pudo eliminar."); } finally { setBusy(false); }
  }

  return (
    <SedeShell
      active="alumnos"
      search={{ value: search, onChange: setSearch, placeholder: "Buscar alumno…" }}
      hero={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-black text-2xl text-text">Alumnos</h1>
            <p className="text-muted font-semibold text-sm">
              {selectedYear ? <>Año lectivo <b className="text-accent-teal">{selectedYear.label}</b> · {filtered.length} alumno(s).</> : `${filtered.length} alumno(s).`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="glass-surface rounded-xl px-3 h-11 font-bold text-text cursor-pointer">
              <option value="">Todos los cursos</option>
              {classes.filter((c) => !selectedYear || c.academicYearId === selectedYear.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => { setCreating(true); setDraft({ name: "", classId: courseFilter }); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn cursor-pointer"><Plus size={18} /> Agregar alumno</button>
          </div>
        </div>
      }
    >
      {msg && <div className="glass-strong rounded-xl px-4 py-2 text-sm font-bold text-accent-strong">{msg}</div>}
      {pass && (
        <div className="glass-strong rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <KeyRound size={16} className="text-amber-500" />
          <span className="font-bold text-text">Contraseña temporal: <code className="bg-white/70 px-2 py-0.5 rounded">{pass.password}</code></span>
          <button type="button" onClick={() => setPass(null)} className="ml-auto text-muted hover:text-text cursor-pointer font-bold">✕</button>
        </div>
      )}

      <DataTable
        rows={filtered}
        getKey={(s) => s.id}
        onRowClick={(s) => navigate(`/admin-sede/alumnos/${s.id}`)}
        columns={[
          { key: "classId", header: "Curso", render: (s) => <span className="text-muted">{s.classId ? classMap.get(s.classId) ?? "—" : "Sin curso"}</span> },
          { key: "fullName", header: "Nombre", render: (s) => <strong className="font-bold text-text">{s.fullName}</strong> },
          { key: "username", header: "Usuario", render: (s) => <span className="text-muted">{s.username ?? "—"}</span> },
          { key: "lastLoginAt", header: "Última conexión", render: (s) => relTime(s.lastLoginAt) },
        ]}
        actions={(s) => (
          <div className="flex items-center gap-1.5 justify-end">
            <button type="button" onClick={() => setEdit({ id: s.id, name: s.fullName, username: s.username ?? "", classId: s.classId ?? "" })} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-white/60 text-text cursor-pointer" aria-label="Editar"><Pencil size={15} /></button>
            <button type="button" onClick={() => resetPass(s.id)} disabled={busy} className="glass-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:brightness-105 cursor-pointer flex items-center gap-1"><KeyRound size={13} /> Clave</button>
            <button type="button" onClick={() => remove(s.id)} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose/20 text-rose cursor-pointer" aria-label="Eliminar"><Trash2 size={15} /></button>
          </div>
        )}
        empty="No hay alumnos. Agregá uno o cargá en masa desde un curso."
      />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 animate-overlay-fade" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setCreating(false)} />
          <form onSubmit={createStudent} className="glass-card-smooth relative z-10 p-6 w-[min(26rem,92vw)] flex flex-col gap-4 animate-card-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-text">Nuevo alumno</h2>
              <button type="button" onClick={() => setCreating(false)} className="w-8 h-8 grid place-items-center rounded-full bg-white/40 text-text/60 hover:text-text cursor-pointer"><X size={16} /></button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Nombre
              <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Curso
              <select value={draft.classId} onChange={(e) => setDraft((d) => ({ ...d, classId: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold cursor-pointer">
                <option value="">Sin curso</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <p className="text-xs text-muted">Para cargar muchos a la vez, entrá a un curso → "Agregar muchos".</p>
            <button type="submit" disabled={busy || !draft.name.trim()} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">Crear alumno</button>
          </form>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 animate-overlay-fade" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setEdit(null)} />
          <form onSubmit={saveEdit} className="glass-card-smooth relative z-10 p-6 w-[min(24rem,92vw)] max-h-[88vh] overflow-y-auto flex flex-col gap-4 animate-card-pop">
            <h2 className="font-display font-bold text-xl text-text">Editar alumno</h2>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Nombre
              <input autoFocus value={edit.name} onChange={(e) => setEdit((x) => x && { ...x, name: e.target.value })} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Usuario
              <input value={edit.username} onChange={(e) => setEdit((x) => x && { ...x, username: e.target.value })} placeholder="usuario de ingreso" className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Curso
              <select value={edit.classId} onChange={(e) => setEdit((x) => x && { ...x, classId: e.target.value })} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold cursor-pointer">
                <option value="">Sin curso</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEdit(null)} className="flex-1 h-11 rounded-xl font-bold text-text bg-white/50 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={busy} className="flex-1 h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </SedeShell>
  );
}
