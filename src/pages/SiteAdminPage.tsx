import { FormEvent, useMemo, useState } from "react";
import {
  BookOpen,
  Copy,
  Download,
  GraduationCap,
  Home,
  LineChart,
  Mail,
  Plus,
  Send,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import {
  buildInvitationLink,
  createClass,
  createInvitation,
  createStudent,
  createTeacher,
  getClassesBySite,
  getDemoData,
  getInvitationsBySite,
  getSiteById,
  getUsersBySite,
  setInvitationStatus,
} from "../utils/storage";
import { sendInvitationEmail } from "../utils/emailService";
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

  const classes = useMemo(() => getClassesBySite(siteId), [siteId, message]);
  const teachers = useMemo(() => getUsersBySite(siteId, "profesor"), [siteId, message]);
  const students = useMemo(() => getUsersBySite(siteId, "alumno"), [siteId, message]);
  const invitations = useMemo(() => getInvitationsBySite(siteId), [siteId, message]);
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");

  function refresh(toast: string) {
    setVersion((v) => v + 1);
    setMessage(toast);
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
    const invitation = createInvitation({ email: inviteDraft.email, name: inviteDraft.name, role: "profesor", siteId, invitedBy: user?.id });
    setInviteDraft({ email: "", name: "" });
    refresh(`Invitación creada para ${invitation.email}`);
    const result = await sendInvitationEmail(invitation);
    if (result.ok) {
      setInvitationStatus(invitation.id, "sent");
      refresh(`Invitación enviada a ${invitation.email}`);
    } else {
      refresh("Invitación lista. Copiá el enlace para compartirlo.");
    }
  }
  async function copyInviteLink(token: string) {
    const link = buildInvitationLink(token);
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
    <div className="kpi-grid">
      <KpiCard icon={BookOpen} label="Cursos" value={classes.length} tone="gold" onClick={() => setSection("cursos")} />
      <KpiCard icon={GraduationCap} label="Docentes" value={teachers.length} tone="blue" onClick={() => setSection("docentes")} />
      <KpiCard icon={Users} label="Alumnos" value={students.length} tone="pink" onClick={() => setSection("alumnos")} />
      <KpiCard icon={Send} label="Invitaciones" value={pendingInvites} tone="violet" onClick={() => setSection("invitaciones")} />
      <KpiCard icon={Zap} label="Clases activas" value={classes.length} tone="green" />
    </div>
  );

  function PeopleList({ people, icon: Icon, empty }: { people: typeof teachers; icon: typeof Users; empty: string }) {
    if (people.length === 0) {
      return <div className="empty-state empty-state--compact"><h3>{empty}</h3></div>;
    }
    return (
      <div className="people-card-grid">
        {people.map((p) => (
          <div key={p.id} className="people-card">
            <span className="people-card__avatar people-card__avatar--green"><Icon size={20} /></span>
            <div>
              <strong>{p.name}</strong>
              <span>{p.email ?? p.username}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hero = (
    <>
      <span className="dash-eyebrow"><Home size={18} /> {site?.city ?? "Tu sede"}</span>
      <h1>{site?.name ?? "Mi sede"} <span className="grad">· Panel de sede</span></h1>
      <p>Gestioná cursos, docentes, alumnos e invitaciones de tu sede. ✨</p>
      <div className="dash-hero__actions">
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
          <div className="dash-grid-2">
            <section className="dash-section">
              <div className="dash-section__head"><h2><BookOpen size={20} /> Cursos recientes</h2></div>
              {classes.length === 0 ? (
                <div className="empty-state empty-state--compact"><h3>Sin cursos todavía</h3><p>Creá tu primer curso.</p></div>
              ) : (
                <div className="people-card-grid">
                  {classes.slice(0, 4).map((c) => (
                    <div key={c.id} className="people-card">
                      <span className="people-card__avatar people-card__avatar--green"><BookOpen size={20} /></span>
                      <div><strong>{c.name}</strong><span>{studentsInClass(c.id).length} alumnos · {c.teacherIds.length} docentes</span></div>
                    </div>
                  ))}
                </div>
              )}
              <Button className="dash-section__cta" onClick={() => setSection("cursos")}><Plus size={18} /> Crear curso</Button>
            </section>
            <section className="dash-section">
              <div className="dash-section__head"><h2><GraduationCap size={20} /> Docentes recientes</h2></div>
              <PeopleList people={teachers.slice(0, 4)} icon={GraduationCap} empty="Sin docentes" />
              <Button className="dash-section__cta" onClick={() => setSection("docentes")}><Plus size={18} /> Crear docente</Button>
            </section>
          </div>
          <section className="dash-section">
            <div className="dash-tip">
              <img src={assets.mascotMaleProud} alt="" decoding="async" />
              <div className="dash-tip__body">
                <h3>Tu sede va por buen camino, {user?.name ?? "Admin"} 🚀</h3>
                <p>Creá cursos, sumá docentes e invitá a tu equipo. Cada clase cuenta, cada alumno brilla.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {section === "cursos" && (
        <section className="dash-section">
          <div className="dash-section__head">
            <div><h2><BookOpen size={20} /> Cursos</h2><p>Cada curso pertenece a esta sede.</p></div>
          </div>
          <form className="admin-form admin-form--inline" onSubmit={submitClass}>
            <input required placeholder="Nombre del curso (ej. 3ro A)" value={classDraft} onChange={(e) => setClassDraft(e.target.value)} />
            <div className="admin-form__actions"><Button type="submit"><Plus size={18} /> Crear curso</Button></div>
          </form>
          {classes.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Sin cursos todavía</h3></div>
          ) : (
            <div className="people-card-grid">
              {classes.map((c) => (
                <div key={c.id} className="people-card">
                  <span className="people-card__avatar people-card__avatar--green"><BookOpen size={20} /></span>
                  <div><strong>{c.name}</strong><span>{studentsInClass(c.id).length} alumnos · {c.teacherIds.length} docentes</span></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "docentes" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><GraduationCap size={20} /> Docentes</h2><p>Se generan usuario y contraseña automáticamente.</p></div></div>
          <form className="admin-form admin-form--inline" onSubmit={submitTeacher}>
            <input required placeholder="Nombre del docente" value={teacherDraft.name} onChange={(e) => setTeacherDraft({ ...teacherDraft, name: e.target.value })} />
            <input type="email" placeholder="Email (opcional)" value={teacherDraft.email} onChange={(e) => setTeacherDraft({ ...teacherDraft, email: e.target.value })} />
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">Sin curso</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="admin-form__actions"><Button type="submit"><Plus size={18} /> Crear docente</Button></div>
          </form>
          <PeopleList people={teachers} icon={GraduationCap} empty="Sin docentes" />
        </section>
      )}

      {section === "alumnos" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><Users size={20} /> Alumnos</h2><p>Asignalos a un curso de la sede.</p></div></div>
          <form className="admin-form admin-form--inline" onSubmit={submitStudent}>
            <input required placeholder="Nombre del alumno" value={studentDraft} onChange={(e) => setStudentDraft(e.target.value)} />
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">Sin curso</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="admin-form__actions"><Button type="submit"><Plus size={18} /> Crear alumno</Button></div>
          </form>

          {/* CSV import — pasted in to handle "I have 30 students" without
              requiring the admin to type each one. Format: header row with
              name,email,role,grade,class. The class column creates a new
              class on the fly if it doesn't exist. */}
          <div className="csv-import">
            <div className="csv-import__head">
              <Upload size={18} />
              <strong>Importar desde CSV</strong>
              <span className="csv-import__hint">Columnas: name, email, role, grade, class</span>
            </div>
            <label className={`csv-import__drop ${importing ? "is-loading" : ""}`}>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <span>{importing ? "Importando…" : "Hacé clic o soltá un .csv acá"}</span>
            </label>
            {importResult && (
              <div className="csv-import__result" role="status">
                <strong>{importResult.created} creados · {importResult.skipped} omitidos</strong>
                <ul>
                  {importResult.rows.slice(0, 20).map((r, i) => (
                    <li key={i} className={r.ok ? "ok" : "err"}>
                      <span>{r.email}</span>
                      {r.ok
                        ? <code>{r.username} / {r.temporaryPassword}</code>
                        : <em>{r.message}</em>}
                    </li>
                  ))}
                </ul>
                {importResult.rows.length > 20 && (
                  <small>Mostrando las primeras 20 de {importResult.rows.length} filas. Descargá el reporte para ver todas con sus claves.</small>
                )}
                <Button type="button" variant="secondary" className="button--sm csv-import__download" onClick={downloadImportReport}>
                  <Download size={16} /> Descargar reporte (.csv)
                </Button>
              </div>
            )}
          </div>

          <PeopleList people={students} icon={Users} empty="Sin alumnos" />
        </section>
      )}

      {section === "invitaciones" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><Mail size={20} /> Invitaciones</h2><p>Generá un enlace y, si el correo está configurado, se envía.</p></div></div>
          <form className="admin-form admin-form--inline" onSubmit={submitInvite}>
            <input required type="email" placeholder="Email del docente" value={inviteDraft.email} onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })} />
            <input placeholder="Nombre (opcional)" value={inviteDraft.name} onChange={(e) => setInviteDraft({ ...inviteDraft, name: e.target.value })} />
            <div className="admin-form__actions"><Button type="submit"><Send size={18} /> Invitar docente</Button></div>
          </form>
          {invitations.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Sin invitaciones</h3><p>Invitá a un docente por email.</p></div>
          ) : (
            <div className="invitation-list">
              {invitations.map((inv) => (
                <div key={inv.id} className="invitation-row">
                  <span className="invitation-row__email"><Mail size={16} /> {inv.email}</span>
                  <span className={`invitation-status invitation-status--${inv.status}`}>{inv.status}</span>
                  <Button variant="secondary" onClick={() => copyInviteLink(inv.token)}><Copy size={16} /> Copiar enlace</Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {section === "progreso" && (
        <section className="dash-section">
          <div className="dash-section__head"><div><h2><LineChart size={20} /> Progreso por curso</h2><p>Promedios básicos para acompañar a cada curso.</p></div></div>
          {classes.length === 0 ? (
            <div className="empty-state empty-state--compact"><h3>Sin datos de progreso</h3></div>
          ) : (
            <div className="dash-content">
              {classes.map((c) => {
                const roster = studentsInClass(c.id);
                const avg = roster.length ? Math.round(roster.reduce((s, u) => s + (u.stats?.precision ?? 0), 0) / roster.length) : 0;
                return (
                  <div key={c.id} className="progress-row">
                    <span className="progress-row__name">{c.name}</span>
                    <div className="progress-track"><div className="progress-track__fill" style={{ width: `${avg}%` }} /></div>
                    <span className="progress-row__pct">{avg}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
