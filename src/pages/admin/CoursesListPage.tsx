import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, X, GraduationCap, Users, Archive } from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";
import { useAcademicYear } from "../../hooks/useAcademicYear";
import { useAuth } from "../../hooks/useAuth";
import { api, type ApiClass } from "../../utils/api";

const GRADES: { value: string; label: string }[] = [
  { value: "inicial", label: "Nivel inicial" },
  { value: "1ep", label: "1° grado" },
  { value: "2ep", label: "2° grado" },
  { value: "3ep", label: "3° grado" },
  { value: "4ep", label: "4° grado" },
  { value: "5ep", label: "5° grado" },
  { value: "6ep", label: "6° grado" },
  { value: "sec", label: "Secundaria" },
  { value: "libre", label: "Libre" },
];
const gradeLabel = (g: string) => GRADES.find((x) => x.value === g)?.label ?? g;

export function CoursesListPage() {
  const navigate = useNavigate();
  const { user, viewAs } = useAuth();
  const siteId = user?.role === "superadmin" && viewAs?.sedeId ? viewAs.sedeId : user?.siteId;
  const { selected: selectedYear, years } = useAcademicYear();

  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", grade: "libre" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try { setClasses(await api.listClasses(siteId, showArchived)); } catch { setMsg("No se pudieron cargar los cursos."); }
  }, [siteId, showArchived]);
  useEffect(() => { void load(); }, [load]);

  // F6: filter by the active academic year (default), with an opt-in
  // to "Todos los años" so the admin can browse the historical list.
  const yearLabelById = useMemo(() => new Map(years.map((y) => [y.id, y.label])), [years]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (!selectedYear) return true;
      if (c.academicYearId === selectedYear.id) return true;
      // Un curso sin año asignado se considera del año vigente — antes el
      // filtro lo escondía y un curso recién creado "desaparecía".
      if (!c.academicYearId && c.status !== "archived") return true;
      // Always show archived courses (they belong to a closed year).
      if (c.status === "archived") return true;
      return false;
    });
  }, [classes, search, selectedYear]);

  async function createCourse(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await api.createClass({ name: draft.name.trim(), sedeId: siteId ?? undefined, grade: draft.grade });
      setCreating(false);
      setDraft({ name: "", grade: "libre" });
      await load();
    } catch { setMsg("No se pudo crear el curso."); } finally { setBusy(false); }
  }

  return (
    <SedeShell
      active="cursos"
      search={{ value: search, onChange: setSearch, placeholder: "Buscar curso…" }}
      hero={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-black text-2xl text-text">Cursos</h1>
            <p className="text-muted font-semibold text-sm">{classes.length} curso(s) en tu sede.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn cursor-pointer">
            <Plus size={18} /> Crear curso
          </button>
        </div>
      }
    >
      {msg && <div className="glass-strong rounded-xl px-4 py-2 text-sm font-bold text-rose">{msg}</div>}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-muted">Año lectivo:</span>
        <span className="text-xs font-extrabold text-accent-teal">{selectedYear?.label ?? "—"}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs font-bold text-muted cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-accent-teal" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar archivados
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && <p className="text-muted font-semibold col-span-full py-6 text-center">No hay cursos en el año seleccionado.</p>}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate(`/admin-sede/curso/${c.id}`)}
            className={`glass-card-smooth rounded-2xl p-5 text-left flex flex-col gap-3 hover:-translate-y-0.5 transition-transform cursor-pointer ${c.status === "archived" ? "opacity-70" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-mint/20 text-mint shrink-0"><BookOpen size={22} /></span>
              <div className="min-w-0 flex-1">
                <strong className="font-display font-extrabold text-lg text-text truncate block">{c.name}</strong>
                <span className="text-xs text-muted font-semibold">{gradeLabel(c.grade)}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.academicYearId && yearLabelById.get(c.academicYearId) && (
                  <span className="text-[10px] font-black uppercase text-muted">{yearLabelById.get(c.academicYearId)}</span>
                )}
                {c.status === "archived" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-muted">
                    <Archive size={11} /> Archivado
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm font-bold text-text">
              <span className="flex items-center gap-1.5"><Users size={16} className="text-accent-strong" /> {c.studentCount}</span>
              <span className="flex items-center gap-1.5"><GraduationCap size={16} className="text-accent-teal" /> {c.teacherCount}</span>
            </div>
          </button>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade" role="dialog" aria-modal="true">
          <div className="modal-overlay" onClick={() => setCreating(false)} />
          <form onSubmit={createCourse} className="glass-card-smooth modal-card relative z-10 p-6 w-[min(26rem,92vw)] flex flex-col gap-4 animate-card-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-text">Nuevo curso</h2>
              <button type="button" onClick={() => setCreating(false)} className="w-8 h-8 grid place-items-center rounded-full bg-white/40 text-text/60 hover:text-text cursor-pointer"><X size={16} /></button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">
              Nombre del curso
              <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="ej: 1° A" className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">
              Grado
              <select value={draft.grade} onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold cursor-pointer">
                {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy || !draft.name.trim()} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">Crear curso</button>
          </form>
        </div>
      )}
    </SedeShell>
  );
}
