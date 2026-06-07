import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Copy,
  Download,
  GraduationCap,
  Home,
  KeyRound,
  LineChart,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import {
  createClass,
  createStudent,
  createTeacher,
  deleteStudent,
  getClassesBySite,
  getDemoData,
  getSiteById,
  getStudentsInClass,
  getTeachersInClass,
  getUsersBySite,
  removeStudentFromClass,
  resetUserPassword,
  updateUserName,
} from "../utils/storage";
import { assets } from "../utils/assets";
import { api } from "../utils/api";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Cursos", icon: BookOpen },
  { id: "docentes", label: "Docentes", icon: GraduationCap },
  { id: "alumnos", label: "Alumnos", icon: Users },
  { id: "invitaciones", label: "Invitaciones", icon: Mail },
  { id: "progreso", label: "Progreso", icon: LineChart },
];

/* ── Shared Tailwind class fragments ── */
const INPUT_CLS =
  "w-full min-h-[3rem] px-4 rounded-xl bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all placeholder:text-muted/50";
const SELECT_CLS =
  "w-full min-h-[3rem] px-4 rounded-xl bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all cursor-pointer";

/* Invitation status pill styles (replaces invitation-status--{status}). */
const inviteStatusCls: Record<string, string> = {
  pending: "bg-accent-sky/20 text-accent-sky",
  sent: "bg-mint/20 text-accent-teal",
  accepted: "bg-mint/30 text-accent-teal",
  expired: "bg-muted/20 text-muted",
};

export function SiteAdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const siteId = user?.siteId;
  const site = getSiteById(siteId);

  const [section, setSection] = useState("inicio");
  const [search, setSearch] = useState("");
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  const [classDraft, setClassDraft] = useState("");
  const [teacherDraft, setTeacherDraft] = useState({ name: "", email: "" });
  const [studentDraft, setStudentDraft] = useState("");
  const [inviteDraft, setInviteDraft] = useState({ email: "", name: "" });
  const [importResult, setImportResult] = useState<null | { created: number; skipped: number; rows: Array<{ ok: boolean; email: string; username?: string; temporaryPassword?: string; message?: string }> }>(null);
  const [importing, setImporting] = useState(false);

  /* Course detail: open a course to manage the students inside it. */
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [courseStudentDraft, setCourseStudentDraft] = useState("");
  const [studentEdit, setStudentEdit] = useState<{ id: string; name: string } | null>(null);
  const [resetInfo, setResetInfo] = useState<{ id: string; password: string } | null>(null);

  const classes = useMemo(() => getClassesBySite(siteId), [siteId, message]);
  const teachers = useMemo(() => getUsersBySite(siteId, "profesor"), [siteId, message]);
  const students = useMemo(() => getUsersBySite(siteId, "alumno"), [siteId, message]);
  const [invitations, setInvitations] = useState<
    Array<{ id: string; email: string; name?: string | null; role: string; status: string; createdAt: string }>
  >([]);
  /** Raw invite links by invitation id, captured at creation time so the
   *  admin can re-copy them (the server never returns the raw token again). */
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const reloadInvites = useCallback(async () => {
    try {
      setInvitations(await api.listInvitations());
    } catch {
      /* keep current list on error */
    }
  }, []);
  useEffect(() => {
    void reloadInvites();
  }, [reloadInvites]);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");

  const openCourse = openCourseId ? classes.find((c) => c.id === openCourseId) ?? null : null;
  const courseStudents = useMemo(
    () => getStudentsInClass(openCourseId ?? undefined),
    [openCourseId, message],
  );
  const courseTeachers = useMemo(
    () => getTeachersInClass(openCourseId ?? undefined),
    [openCourseId, message],
  );

  function refresh(toast: string) {
    setVersion((v) => v + 1);
    setMessage(toast);
  }

  /* ---- Course-detail handlers (manage students inside a course) ---- */
  function closeCourse() {
    setOpenCourseId(null);
    setStudentEdit(null);
    setResetInfo(null);
    setCourseStudentDraft("");
  }
  function addStudentToCourse(e: FormEvent) {
    e.preventDefault();
    if (!openCourseId || !courseStudentDraft.trim()) return;
    const s = createStudent({ name: courseStudentDraft, siteId, classId: openCourseId });
    setCourseStudentDraft("");
    refresh(`Alumno agregado: ${s.username} / ${s.password}`);
  }
  function saveStudentName() {
    if (!studentEdit || !studentEdit.name.trim()) return;
    updateUserName(studentEdit.id, studentEdit.name);
    setStudentEdit(null);
    refresh("Nombre del alumno actualizado.");
  }
  function resetStudentPassword(id: string, username?: string) {
    const password = resetUserPassword(id);
    if (password) {
      setResetInfo({ id, password });
      refresh(`Contraseña restablecida para ${username ?? "el alumno"}.`);
    }
  }
  function removeStudent(id: string) {
    if (!openCourseId) return;
    removeStudentFromClass(id, openCourseId);
    refresh("Alumno quitado del curso.");
  }
  function deleteStudentAccount(id: string) {
    deleteStudent(id);
    setStudentEdit(null);
    refresh("Alumno eliminado.");
  }

  function submitClass(e: FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    const created = createClass({ name: classDraft, siteId });
    setClassDraft("");
    setSelectedClass((prev) => prev || created.id);
    refresh(`Curso creado: ${created.name}`);
  }
  function submitTeacher(e: FormEvent) {
    e.preventDefault();
    const t = createTeacher({ name: teacherDraft.name, email: teacherDraft.email, siteId, classId: selectedClass || undefined });
    setTeacherDraft({ name: "", email: "" });
    refresh(`Docente creado: ${t.username} / ${t.password}`);
  }
  function submitStudent(e: FormEvent) {
    e.preventDefault();
    const s = createStudent({ name: studentDraft, siteId, classId: selectedClass || undefined });
    setStudentDraft("");
    refresh(`Alumno creado: ${s.username} / ${s.password}`);
  }
  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.createInvitation({
        email: inviteDraft.email,
        name: inviteDraft.name || undefined,
        role: "profesor",
      });
      setInviteDraft({ email: "", name: "" });
      setInviteLinks((prev) => ({ ...prev, [res.invitation.id]: res.link }));
      await reloadInvites();
      try {
        await navigator.clipboard.writeText(res.link);
      } catch {
        /* clipboard may be unavailable */
      }
      refresh(
        res.emailed
          ? `Invitación enviada por email a ${res.invitation.email}`
          : "Invitación creada. Enlace copiado para compartir.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo crear la invitación.");
    }
  }
  async function copyInviteLink(id: string) {
    const link = inviteLinks[id];
    if (!link) {
      setMessage("El enlace solo se puede copiar al crear la invitación. Reenviá una nueva si lo necesitás.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Enlace de invitación copiado.");
    } catch {
      setMessage(link);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const csv = await file.text();
      const res = await api.importUsersCsv(csv);
      setImportResult({
        created: res.created,
        skipped: res.skipped,
        rows: res.results.map((r) => ({
          ok: r.ok,
          email: r.email,
          username: r.username,
          temporaryPassword: r.temporaryPassword,
          message: r.message,
        })),
      });
      refresh(`Importación lista: ${res.created} creados, ${res.skipped} omitidos.`);
    } catch (err) {
      refresh(err instanceof Error ? err.message : "Error importando el CSV.");
    } finally {
      setImporting(false);
    }
  }
  /* Download the FULL import result (every row, including temp passwords) as a
     CSV so the admin can hand out credentials. The on-screen list only previews
     the first rows; this is the complete, authoritative record. */
  function downloadImportReport() {
    if (!importResult) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = "email,usuario,clave_temporal,estado,detalle";
    const lines = importResult.rows.map((r) =>
      [
        esc(r.email ?? ""),
        esc(r.username ?? ""),
        esc(r.temporaryPassword ?? ""),
        r.ok ? "creado" : "omitido",
        esc(r.message ?? ""),
      ].join(","),
    );
    const blob = new Blob([`${header}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `importacion-alumnos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage("Reporte descargado.");
  }
  function leave() {
    logout();
    navigate("/login");
  }

  const allUsers = getDemoData().users;
  const studentsInClass = (classId: string) => allUsers.filter((u) => u.role === "alumno" && u.classId === classId);
  const pendingInvites = invitations.filter((i) => i.status === "pending").length;

  const kpis = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard icon={BookOpen} label="Cursos" value={classes.length} tone="gold" onClick={() => setSection("cursos")} />
      <KpiCard icon={GraduationCap} label="Docentes" value={teachers.length} tone="blue" onClick={() => setSection("docentes")} />
      <KpiCard icon={Users} label="Alumnos" value={students.length} tone="pink" onClick={() => setSection("alumnos")} />
      <KpiCard icon={Send} label="Invitaciones" value={pendingInvites} tone="violet" onClick={() => setSection("invitaciones")} />
      <KpiCard icon={Zap} label="Clases activas" value={classes.length} tone="green" />
    </div>
  );

  function PeopleList({ people, icon: Icon, empty }: { people: typeof teachers; icon: typeof Users; empty: string }) {
    if (people.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
          <h3 className="font-display text-lg font-bold text-text">{empty}</h3>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {people.map((p) => (
          <div key={p.id} className="glass-surface flex items-center gap-3 p-4 animate-card-in">
            <span className="grid place-items-center w-10 h-10 rounded-full bg-mint/20 text-accent-teal shrink-0">
              <Icon size={20} />
            </span>
            <div className="flex flex-col min-w-0">
              <strong className="text-sm text-text truncate">{p.name}</strong>
              <span className="text-xs text-muted truncate">{p.email ?? p.username}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hero = (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <Home size={18} /> {site?.city ?? "Tu sede"}
      </span>
      <h1 className="font-display text-3xl font-bold text-text">
        {site?.name ?? "Mi sede"}{" "}
        <span className="bg-gradient-to-r from-accent-sky via-accent to-accent-pink bg-clip-text text-transparent">
          · Panel de sede
        </span>
      </h1>
      <p className="text-muted font-semibold">Gestioná cursos, docentes, alumnos e invitaciones de tu sede. ✨</p>
      <div className="flex flex-wrap gap-3 mt-2">
        <Button variant="secondary" onClick={() => setSection("invitaciones")}><Send size={18} /> Invitar docente</Button>
        <Button onClick={() => setSection("cursos")}><Plus size={18} /> Crear curso</Button>
      </div>
    </>
  );

  return (
    <DashboardShell
      accent="green"
      roleLabel="ADMIN DE SEDE"
      roleSubtitle={site?.name ?? "Sede"}
      roleIcon={Home}
      account={{ name: user?.name ?? "Admin de sede", email: user?.email ?? "admin@typely.com", initial: (user?.name ?? "A").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotFemaleLaptop}
      nav={NAV}
      activeId={section}
      onNavigate={setSection}
      onLogout={leave}
      search={{ value: search, onChange: setSearch, placeholder: "Buscar cursos, docentes, alumnos…" }}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      {section === "inicio" && (
        <>
          {kpis}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                  <BookOpen size={20} /> Cursos recientes
                </h2>
              </div>
              {classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
                  <h3 className="font-display text-lg font-bold text-text">Sin cursos todavía</h3>
                  <p className="text-muted font-semibold text-sm">Creá tu primer curso.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {classes.slice(0, 4).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="glass-surface flex items-center gap-3 p-4 animate-card-in cursor-pointer border-0 text-left w-full hover:-translate-y-0.5 transition-transform"
                      onClick={() => setOpenCourseId(c.id)}
                      title="Abrir curso"
                    >
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-mint/20 text-accent-teal shrink-0">
                        <BookOpen size={20} />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <strong className="text-sm text-text truncate">{c.name}</strong>
                        <span className="text-xs text-muted truncate">{studentsInClass(c.id).length} alumnos · {c.teacherIds.length} docentes</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <Button className="mt-auto self-start" onClick={() => setSection("cursos")}><Plus size={18} /> Crear curso</Button>
            </section>
            <section className="glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                  <GraduationCap size={20} /> Docentes recientes
                </h2>
              </div>
              <PeopleList people={teachers.slice(0, 4)} icon={GraduationCap} empty="Sin docentes" />
              <Button className="mt-auto self-start" onClick={() => setSection("docentes")}><Plus size={18} /> Crear docente</Button>
            </section>
          </div>
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-5 p-2">
              <img src={assets.mascotMaleProud} alt="" decoding="async" className="w-20 h-auto shrink-0" />
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg font-bold text-text">Tu sede va por buen camino, {user?.name ?? "Admin"} 🚀</h3>
                <p className="text-muted font-semibold text-sm">Creá cursos, sumá docentes e invitá a tu equipo. Cada clase cuenta, cada alumno brilla.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {section === "cursos" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <BookOpen size={20} /> Cursos
              </h2>
              <p className="text-sm text-muted font-semibold">Cada curso pertenece a esta sede.</p>
            </div>
          </div>
          <form className="flex flex-row flex-wrap items-end gap-4" onSubmit={submitClass}>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[14rem]">
              <input
                required
                className={INPUT_CLS}
                placeholder="Nombre del curso (ej. 3ro A)"
                value={classDraft}
                onChange={(e) => setClassDraft(e.target.value)}
              />
            </label>
            <div className="flex gap-3 mt-1">
              <Button type="submit"><Plus size={18} /> Crear curso</Button>
            </div>
          </form>
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
              <h3 className="font-display text-lg font-bold text-text">Sin cursos todavía</h3>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted font-semibold animate-soft-hint-in">Tocá un curso para ver y editar sus alumnos.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {classes.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="glass-surface flex items-center gap-3 p-4 animate-card-in cursor-pointer border-0 text-left w-full hover:-translate-y-0.5 transition-transform"
                    onClick={() => setOpenCourseId(c.id)}
                    title="Abrir curso"
                  >
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-mint/20 text-accent-teal shrink-0">
                      <BookOpen size={20} />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <strong className="text-sm text-text truncate">{c.name}</strong>
                      <span className="text-xs text-muted truncate">{studentsInClass(c.id).length} alumnos · {c.teacherIds.length} docentes</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {section === "docentes" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <GraduationCap size={20} /> Docentes
              </h2>
              <p className="text-sm text-muted font-semibold">Se generan usuario y contraseña automáticamente.</p>
            </div>
          </div>
          <form className="flex flex-row flex-wrap items-end gap-4" onSubmit={submitTeacher}>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
              <input
                required
                className={INPUT_CLS}
                placeholder="Nombre del docente"
                value={teacherDraft.name}
                onChange={(e) => setTeacherDraft({ ...teacherDraft, name: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
              <input
                type="email"
                className={INPUT_CLS}
                placeholder="Email (opcional)"
                value={teacherDraft.email}
                onChange={(e) => setTeacherDraft({ ...teacherDraft, email: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 min-w-[10rem]">
              <select className={SELECT_CLS} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Sin curso</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="flex gap-3 mt-1">
              <Button type="submit"><Plus size={18} /> Crear docente</Button>
            </div>
          </form>
          <PeopleList people={teachers} icon={GraduationCap} empty="Sin docentes" />
        </section>
      )}

      {section === "alumnos" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <Users size={20} /> Alumnos
              </h2>
              <p className="text-sm text-muted font-semibold">Asignalos a un curso de la sede.</p>
            </div>
          </div>
          <form className="flex flex-row flex-wrap items-end gap-4" onSubmit={submitStudent}>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
              <input
                required
                className={INPUT_CLS}
                placeholder="Nombre del alumno"
                value={studentDraft}
                onChange={(e) => setStudentDraft(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 min-w-[10rem]">
              <select className={SELECT_CLS} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Sin curso</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="flex gap-3 mt-1">
              <Button type="submit"><Plus size={18} /> Crear alumno</Button>
            </div>
          </form>

          {/* CSV import — pasted in to handle "I have 30 students" without
              requiring the admin to type each one. Format: header row with
              name,email,role,grade,class. The class column creates a new
              class on the fly if it doesn't exist. */}
          <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/40 border border-white/50">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-accent" />
              <strong className="text-sm text-text">Importar desde CSV</strong>
              <span className="text-xs text-muted">Columnas: name, email, role, grade, class</span>
            </div>
            <label
              className={`flex items-center justify-center p-6 rounded-xl border-2 border-dashed border-white/60 bg-white/30 cursor-pointer text-sm font-semibold text-muted hover:bg-white/50 transition-colors ${
                importing ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importing}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <span>{importing ? "Importando…" : "Hacé clic o soltá un .csv acá"}</span>
            </label>
            {importResult && (
              <div className="flex flex-col gap-2 text-sm" role="status">
                <strong className="text-text">{importResult.created} creados · {importResult.skipped} omitidos</strong>
                <ul className="flex flex-col gap-1 list-none p-0 m-0">
                  {importResult.rows.slice(0, 20).map((r, i) => (
                    <li key={i} className={`text-xs px-2 py-1 rounded-lg ${r.ok ? "bg-mint/10 text-accent-teal" : "bg-rose/10 text-rose"}`}>
                      <span className="font-semibold">{r.email}</span>
                      {r.ok
                        ? <code className="ml-2 bg-white/50 px-1 rounded">{r.username} / {r.temporaryPassword}</code>
                        : <em className="ml-2">{r.message}</em>}
                    </li>
                  ))}
                </ul>
                {importResult.rows.length > 20 && (
                  <small className="text-xs text-muted">Mostrando las primeras 20 de {importResult.rows.length} filas. Descargá el reporte para ver todas con sus claves.</small>
                )}
                <Button type="button" variant="secondary" className="min-h-[2.25rem] px-3 text-sm self-start mt-2" onClick={downloadImportReport}>
                  <Download size={16} /> Descargar reporte (.csv)
                </Button>
              </div>
            )}
          </div>

          <PeopleList people={students} icon={Users} empty="Sin alumnos" />
        </section>
      )}

      {section === "invitaciones" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <Mail size={20} /> Invitaciones
              </h2>
              <p className="text-sm text-muted font-semibold">Generá un enlace y, si el correo está configurado, se envía.</p>
            </div>
          </div>
          <form className="flex flex-row flex-wrap items-end gap-4" onSubmit={submitInvite}>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
              <input
                required
                type="email"
                className={INPUT_CLS}
                placeholder="Email del docente"
                value={inviteDraft.email}
                onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
              <input
                className={INPUT_CLS}
                placeholder="Nombre (opcional)"
                value={inviteDraft.name}
                onChange={(e) => setInviteDraft({ ...inviteDraft, name: e.target.value })}
              />
            </label>
            <div className="flex gap-3 mt-1">
              <Button type="submit"><Send size={18} /> Invitar docente</Button>
            </div>
          </form>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
              <h3 className="font-display text-lg font-bold text-text">Sin invitaciones</h3>
              <p className="text-muted font-semibold text-sm">Invitá a un docente por email.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-white/40">
                  <span className="flex items-center gap-2 text-sm font-semibold text-text min-w-0 flex-1">
                    <Mail size={16} className="shrink-0" /> {inv.email}
                  </span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${inviteStatusCls[inv.status] ?? "bg-white/40 text-muted"}`}>
                    {inv.status}
                  </span>
                  <Button variant="secondary" className="min-h-[2.25rem] px-3 text-sm" onClick={() => copyInviteLink(inv.id)}>
                    <Copy size={16} /> Copiar enlace
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "progreso" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <LineChart size={20} /> Progreso por curso
              </h2>
              <p className="text-sm text-muted font-semibold">Promedios básicos para acompañar a cada curso.</p>
            </div>
          </div>
          {classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
              <h3 className="font-display text-lg font-bold text-text">Sin datos de progreso</h3>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {classes.map((c) => {
                const roster = studentsInClass(c.id);
                const avg = roster.length ? Math.round(roster.reduce((s, u) => s + (u.stats?.precision ?? 0), 0) / roster.length) : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-text w-28 shrink-0 truncate">{c.name}</span>
                    <div className="flex-1 h-3 rounded-full bg-white/50 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-teal transition-all" style={{ width: `${avg}%` }} />
                    </div>
                    <span className="text-sm font-bold text-muted w-12 text-right">{avg}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {openCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="course-modal-title">
          <div className="absolute inset-0 bg-black/30 animate-overlay-fade" onClick={closeCourse} />
          <div className="glass-card-smooth relative max-h-[88vh] overflow-y-auto p-8 w-[min(34rem,94vw)] flex flex-col gap-5 animate-menu-reveal">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-accent/15 text-accent" aria-hidden="true">
              <BookOpen size={24} />
            </span>
            <h2 id="course-modal-title" className="font-display text-xl font-bold text-text">{openCourse.name}</h2>
            <p className="text-muted font-semibold text-sm">{courseStudents.length} alumnos · {courseTeachers.length} docentes</p>

            <div className="flex flex-col gap-3">
              <h3 className="font-display text-base font-bold text-text flex items-center gap-2">
                <GraduationCap size={16} /> Docentes
              </h3>
              {courseTeachers.length === 0 ? (
                <small className="text-xs text-muted">Sin docentes asignados a este curso.</small>
              ) : (
                <ul className="flex flex-col gap-2 list-none p-0 m-0">
                  {courseTeachers.map((t) => (
                    <li key={t.id} className="flex flex-col text-sm">
                      <strong className="text-text">{t.name}</strong>
                      <span className="text-xs text-muted">{t.email ?? t.username}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="font-display text-base font-bold text-text flex items-center gap-2">
                <Users size={16} /> Alumnos
              </h3>
              <form className="flex flex-row flex-wrap items-end gap-4 mt-1" onSubmit={addStudentToCourse}>
                <label className="flex flex-col gap-1.5 flex-1 min-w-[10rem]">
                  <input
                    className={INPUT_CLS}
                    placeholder="Nombre del nuevo alumno"
                    value={courseStudentDraft}
                    onChange={(e) => setCourseStudentDraft(e.target.value)}
                  />
                </label>
                <Button type="submit" className="min-h-[2.25rem] px-3 text-sm"><Plus size={16} /> Agregar</Button>
              </form>

              {courseStudents.length === 0 ? (
                <small className="text-xs text-muted">Este curso todavía no tiene alumnos.</small>
              ) : (
                <ul className="flex flex-col gap-3 list-none p-0 m-0">
                  {courseStudents.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white/40">
                      <div className="flex flex-col min-w-0">
                        {studentEdit?.id === s.id ? (
                          <input
                            className="w-full min-h-[2.5rem] px-3 rounded-lg bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20"
                            value={studentEdit.name}
                            autoFocus
                            onChange={(e) => setStudentEdit({ id: s.id, name: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") saveStudentName(); if (e.key === "Escape") setStudentEdit(null); }}
                          />
                        ) : (
                          <>
                            <strong className="text-sm text-text">{s.name}</strong>
                            <span className="text-xs text-muted">{s.username} · {Math.round(s.stats?.precision ?? 0)}% precisión</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {studentEdit?.id === s.id ? (
                          <>
                            <button
                              type="button"
                              className="grid place-items-center w-8 h-8 rounded-lg bg-mint/30 text-accent-teal cursor-pointer border-0 transition-colors text-sm font-bold"
                              onClick={saveStudentName}
                              aria-label="Guardar nombre"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="grid place-items-center w-8 h-8 rounded-lg bg-white/50 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors text-sm"
                              onClick={() => setStudentEdit(null)}
                              aria-label="Cancelar"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="grid place-items-center w-8 h-8 rounded-lg bg-white/50 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors"
                              onClick={() => setStudentEdit({ id: s.id, name: s.name })}
                              aria-label={`Editar ${s.name}`}
                              title="Editar nombre"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="grid place-items-center w-8 h-8 rounded-lg bg-white/50 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors"
                              onClick={() => resetStudentPassword(s.id, s.username)}
                              aria-label={`Restablecer contraseña de ${s.name}`}
                              title="Restablecer contraseña"
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              type="button"
                              className="grid place-items-center w-8 h-8 rounded-lg bg-white/50 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors"
                              onClick={() => removeStudent(s.id)}
                              aria-label={`Quitar a ${s.name} del curso`}
                              title="Quitar del curso"
                            >
                              <Trash2 size={15} />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1 px-2 h-8 rounded-lg bg-rose/20 text-rose cursor-pointer border-0 transition-colors text-xs font-bold"
                              onClick={() => deleteStudentAccount(s.id)}
                              aria-label={`Eliminar a ${s.name}`}
                              title="Eliminar alumno"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                      {resetInfo?.id === s.id && (
                        <code className="text-xs font-semibold text-accent-teal bg-accent-teal/10 px-3 py-1.5 rounded-lg">
                          Nueva clave temporal: {s.username} / {resetInfo.password}
                        </code>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={closeCourse}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
