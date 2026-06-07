import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Crown,
  GraduationCap,
  Home,
  ImagePlus,
  KeyRound,
  Pencil,
  Plus,
  School,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import type { EduTicUser, Site } from "../types";
import {
  createSedeAdmin,
  createSite,
  deleteSedeAdmin,
  getDemoData,
  getEcosystemCounts,
  resetUserPassword,
  updateSedeAdmin,
  updateSite,
} from "../utils/storage";
import { fileToResizedDataUrl } from "../utils/image";
import { assets } from "../utils/assets";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "sedes", label: "Sedes", icon: School },
  { id: "admins", label: "Admins de sede", icon: ShieldCheck },
];

/* ── Shared Tailwind class fragments ── */
const INPUT_CLS =
  "w-full min-h-[3rem] px-4 rounded-xl bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all placeholder:text-muted/50";
const SELECT_CLS =
  "w-full min-h-[3rem] px-4 rounded-xl bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20 transition-all cursor-pointer";
const BTN_SM = "min-h-[2.25rem] px-3 text-sm";

interface SiteDraft {
  name: string;
  city: string;
  photo: string;
}
const EMPTY_SITE: SiteDraft = { name: "", city: "", photo: "" };

interface AdminDraft {
  name: string;
  email: string;
  siteId: string;
  active: boolean;
}
const EMPTY_ADMIN: AdminDraft = { name: "", email: "", siteId: "", active: true };

export function AdminGeneralPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState("inicio");
  const [search, setSearch] = useState("");
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  const [showSiteForm, setShowSiteForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState("");
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(EMPTY_SITE);

  // Admin create/edit modal. `editingAdminId` empty → create mode.
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState("");
  const [adminDraft, setAdminDraft] = useState<AdminDraft>(EMPTY_ADMIN);
  /** Temp password produced by a reset — shown once, never the stored one. */
  const [tempPassword, setTempPassword] = useState("");
  /** Admin pending hard-delete confirmation (id + name for the dialog). */
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const data = useMemo(() => getDemoData(), [message]);
  const counts = useMemo(() => getEcosystemCounts(), [message]);

  function refresh(toast?: string) {
    setVersion((v) => v + 1);
    if (toast) setMessage(toast);
  }

  /* ---- Sede form ---- */
  function startCreateSite() {
    setSection("sedes");
    setEditingSiteId("");
    setSiteDraft(EMPTY_SITE);
    setShowSiteForm(true);
  }
  function startEditSite(site: Site) {
    setEditingSiteId(site.id);
    setSiteDraft({ name: site.name, city: site.city, photo: site.photo ?? "" });
    setShowSiteForm(true);
  }
  async function onPhotoPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setSiteDraft((d) => ({ ...d, photo: dataUrl }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
    }
  }
  function submitSite(event: FormEvent) {
    event.preventDefault();
    if (editingSiteId) {
      updateSite(editingSiteId, { name: siteDraft.name, city: siteDraft.city, photo: siteDraft.photo || undefined });
      refresh("Sede actualizada.");
    } else {
      const site = createSite(siteDraft);
      refresh(`Sede creada: ${site.name}`);
    }
    setShowSiteForm(false);
    setEditingSiteId("");
    setSiteDraft(EMPTY_SITE);
  }

  /* ---- Admin create / edit ---- */
  function openCreateAdmin() {
    setEditingAdminId("");
    setTempPassword("");
    setAdminDraft({ ...EMPTY_ADMIN, siteId: data.sites[0]?.id ?? "" });
    setShowAdminModal(true);
  }
  function openEditAdmin(admin: EduTicUser) {
    setEditingAdminId(admin.id);
    setTempPassword("");
    setAdminDraft({
      name: admin.name,
      email: admin.email ?? "",
      siteId: admin.siteId ?? data.sites[0]?.id ?? "",
      active: admin.active !== false,
    });
    setShowAdminModal(true);
  }
  function closeAdminModal() {
    setShowAdminModal(false);
    setEditingAdminId("");
    setTempPassword("");
  }
  function submitAdmin(event: FormEvent) {
    event.preventDefault();
    if (!adminDraft.email.trim()) {
      setMessage("El email del administrador es obligatorio.");
      return;
    }
    if (!adminDraft.siteId) {
      setMessage("Elegí una sede para el administrador.");
      return;
    }
    if (editingAdminId) {
      updateSedeAdmin(editingAdminId, {
        name: adminDraft.name,
        email: adminDraft.email,
        siteId: adminDraft.siteId,
        active: adminDraft.active,
      });
      closeAdminModal();
      refresh("Admin de sede actualizado.");
    } else {
      const admin = createSedeAdmin({
        name: adminDraft.name,
        email: adminDraft.email,
        siteId: adminDraft.siteId,
      });
      closeAdminModal();
      refresh(`Admin creado · usuario ${admin.username} · clave temporal ${admin.password}`);
    }
  }
  function doResetPassword() {
    if (!editingAdminId) return;
    const next = resetUserPassword(editingAdminId);
    if (next) {
      setTempPassword(next);
      refresh();
    }
  }
  function askDeleteCurrentAdmin() {
    if (!editingAdminId) return;
    setConfirmDelete({ id: editingAdminId, name: adminDraft.name || "este admin" });
  }
  function confirmDeleteAdmin() {
    if (!confirmDelete) return;
    deleteSedeAdmin(confirmDelete.id);
    setConfirmDelete(null);
    closeAdminModal();
    refresh("Admin de sede eliminado.");
  }

  const sedeAdmins = data.users.filter((u) => u.role === "admin-sede");
  const siteName = (id?: string) => data.sites.find((s) => s.id === id)?.name ?? "Sin sede";
  const countFor = (siteId: string, role: "alumno" | "profesor") =>
    data.users.filter((u) => u.siteId === siteId && u.role === role).length;
  const classesFor = (siteId: string) => data.classes.filter((c) => c.siteId === siteId).length;

  const q = search.trim().toLowerCase();
  const filteredSites = q
    ? data.sites.filter((s) => `${s.name} ${s.city}`.toLowerCase().includes(q))
    : data.sites;
  const filteredAdmins = q
    ? sedeAdmins.filter((a) => `${a.name} ${a.email ?? ""}`.toLowerCase().includes(q))
    : sedeAdmins;

  const kpis = (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <KpiCard icon={School} label="Sedes" value={counts.sedes} tone="green" trend="↑ ecosistema" onClick={() => setSection("sedes")} />
      <KpiCard icon={ShieldCheck} label="Admins de sede" value={counts.sedeAdmins} tone="violet" onClick={() => setSection("admins")} />
      <KpiCard icon={GraduationCap} label="Docentes" value={counts.teachers} tone="blue" />
      <KpiCard icon={Users} label="Alumnos" value={counts.students} tone="pink" />
      <KpiCard icon={Building2} label="Cursos" value={counts.classes} tone="gold" />
    </div>
  );

  function SedeCards({ sites }: { sites: Site[] }) {
    if (sites.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-10 px-4">
          <img src={assets.mascotFemaleLaptop} alt="" decoding="async" className="w-28 h-auto" />
          <h3 className="font-display text-lg font-bold text-text">Todavía no hay sedes</h3>
          <p className="text-muted font-semibold text-sm">Creá tu primera sede para empezar a construir el ecosistema Typely.</p>
          <Button className={BTN_SM} onClick={startCreateSite}>
            <Plus size={18} /> Crear sede
          </Button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {sites.map((site) => (
          <div key={site.id} className="glass-card overflow-hidden flex flex-col animate-card-in">
            <div className="relative h-40 bg-accent-sky/15 overflow-hidden">
              <span
                className={`absolute top-3 right-3 z-10 text-xs font-bold px-3 py-1 rounded-full text-white ${
                  site.active === false ? "bg-muted/60" : "bg-mint"
                }`}
              >
                {site.active === false ? "Inactiva" : "Activa"}
              </span>
              {site.photo ? (
                <img
                  className="w-full h-full object-cover"
                  src={site.photo}
                  alt={`Foto de ${site.name}`}
                  decoding="async"
                  loading="lazy"
                />
              ) : (
                <span className="flex flex-col items-center justify-center gap-1 h-full text-muted" aria-hidden="true">
                  <School size={30} />
                  <small>Sin foto del colegio</small>
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col gap-2">
              <strong className="text-text">{site.name}</strong>
              <span className="text-sm text-muted">{site.city}</span>
              <div className="flex items-center gap-3 text-sm text-muted font-semibold">
                <span className="inline-flex items-center gap-1"><Users size={15} /> {countFor(site.id, "alumno")}</span>
                <span className="inline-flex items-center gap-1"><GraduationCap size={15} /> {countFor(site.id, "profesor")}</span>
                <span className="inline-flex items-center gap-1"><Building2 size={15} /> {classesFor(site.id)}</span>
              </div>
              <Button className={`${BTN_SM} self-start mt-auto`} variant="secondary" onClick={() => startEditSite(site)}>
                <Pencil size={15} /> Editar sede
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function AdminCards({ admins }: { admins: EduTicUser[] }) {
    if (admins.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
          <h3 className="font-display text-lg font-bold text-text">Sin administradores de sede</h3>
          <p className="text-muted font-semibold text-sm">
            {data.sites.length === 0
              ? "Primero creá una sede, luego asignale un administrador."
              : "Creá un administrador y asignalo a una de tus sedes."}
          </p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className={`glass-surface flex items-center gap-3 p-4 animate-card-in ${admin.active === false ? "opacity-60" : ""}`}
          >
            <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent shrink-0">
              <ShieldCheck size={20} />
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <strong className="text-sm text-text truncate">{admin.name}</strong>
              <span className="text-xs text-muted truncate">{admin.email ?? admin.username}</span>
              <small className="text-xs text-muted/70 truncate">{siteName(admin.siteId)}</small>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full text-white shrink-0 ${
                admin.active === false ? "bg-muted/60" : "bg-mint"
              }`}
            >
              {admin.active === false ? "Inactivo" : "Activo"}
            </span>
            <button
              type="button"
              className="grid place-items-center w-8 h-8 rounded-full bg-white/40 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors shrink-0"
              aria-label={`Editar ${admin.name}`}
              onClick={() => openEditAdmin(admin)}
            >
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  const hero = (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <Crown size={18} /> ¡Bienvenido, Superadmin!
      </span>
      <h1 className="font-display text-3xl font-bold text-text">
        Panel{" "}
        <span className="bg-gradient-to-r from-accent-sky via-accent to-accent-pink bg-clip-text text-transparent">
          Superadmin
        </span>
      </h1>
      <p className="text-muted font-semibold">Gestioná las sedes y sus administradores del ecosistema Typely desde un solo lugar.</p>
      <div className="flex flex-wrap gap-3 mt-2">
        <Button className={BTN_SM} onClick={startCreateSite}>
          <Plus size={18} /> Crear sede
        </Button>
        <Button
          className={BTN_SM}
          variant="secondary"
          onClick={openCreateAdmin}
          disabled={data.sites.length === 0}
          title={data.sites.length === 0 ? "Primero creá una sede para poder asignarle un administrador." : undefined}
        >
          <UserCog size={18} /> Crear admin de sede
        </Button>
      </div>
    </>
  );

  return (
    <DashboardShell
      accent="violet"
      roleLabel="SUPERADMIN"
      roleSubtitle="Sedes y administradores"
      roleIcon={Crown}
      account={{ name: user?.name ?? "Superadmin", email: user?.email ?? "superadmin@typely.com", initial: "S" }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId={section}
      onNavigate={setSection}
      onLogout={() => {
        logout();
        navigate("/login");
      }}
      search={{ value: search, onChange: setSearch, placeholder: "Buscar sedes, admins…" }}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      bellCount={0}
      hero={hero}
    >
      {section === "inicio" && (
        <>
          {kpis}
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <School size={22} /> Sedes activas
              </h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-strong transition-colors cursor-pointer bg-transparent border-0"
                onClick={() => setSection("sedes")}
              >
                Ver todas <ArrowRight size={16} />
              </button>
            </div>
            <SedeCards sites={data.sites.slice(0, 4)} />
          </section>
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <ShieldCheck size={22} /> Administradores de sede
              </h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-strong transition-colors cursor-pointer bg-transparent border-0"
                onClick={() => setSection("admins")}
              >
                Ver todos <ArrowRight size={16} />
              </button>
            </div>
            <AdminCards admins={sedeAdmins.slice(0, 6)} />
          </section>
        </>
      )}

      {section === "sedes" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <School size={22} /> Sedes
              </h2>
              <p className="text-sm text-muted font-semibold">Colegios y campus del ecosistema.</p>
            </div>
            <Button className={BTN_SM} onClick={startCreateSite}>
              <Plus size={18} /> Crear sede
            </Button>
          </div>
          {showSiteForm && (
            <form className="flex flex-col gap-4" onSubmit={submitSite}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-text">Nombre de la sede</span>
                  <input
                    required
                    className={INPUT_CLS}
                    placeholder="Colegio San Martín"
                    value={siteDraft.name}
                    onChange={(e) => setSiteDraft({ ...siteDraft, name: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-text">Ciudad / ubicación</span>
                  <input
                    className={INPUT_CLS}
                    placeholder="Buenos Aires"
                    value={siteDraft.city}
                    onChange={(e) => setSiteDraft({ ...siteDraft, city: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div
                  className={`w-32 h-32 rounded-xl border-2 border-dashed grid place-items-center overflow-hidden shrink-0 ${
                    siteDraft.photo
                      ? "border-solid border-white/80"
                      : "bg-accent-sky/10 border-white/60"
                  }`}
                >
                  {siteDraft.photo ? (
                    <img src={siteDraft.photo} alt="Vista previa de la sede" className="w-full h-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-muted">
                      <School size={26} />
                      <small>Sin foto</small>
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className={`inline-flex items-center gap-1.5 min-h-[2.25rem] px-3 rounded-xl font-bold cursor-pointer transition-all bg-white/75 text-text shadow hover:bg-white/90 text-sm`}>
                    <ImagePlus size={16} /> {siteDraft.photo ? "Cambiar foto" : "Subir foto del colegio"}
                    <input type="file" accept="image/*" onChange={onPhotoPick} hidden />
                  </label>
                  {siteDraft.photo && (
                    <button
                      type="button"
                      className="text-sm font-bold text-rose hover:text-rose/80 cursor-pointer bg-transparent border-0 self-start inline-flex items-center gap-1"
                      onClick={() => setSiteDraft({ ...siteDraft, photo: "" })}
                    >
                      <Trash2 size={15} /> Quitar
                    </button>
                  )}
                  <small className="text-xs text-muted">JPG o PNG. Se ajusta automáticamente.</small>
                </div>
              </div>
              <div className="flex gap-3 mt-1">
                <Button type="submit" className={BTN_SM}>
                  {editingSiteId ? "Guardar cambios" : "Crear sede"}
                </Button>
                <Button type="button" variant="ghost" className={BTN_SM} onClick={() => setShowSiteForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
          <SedeCards sites={filteredSites} />
        </section>
      )}

      {section === "admins" && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
                <ShieldCheck size={22} /> Administradores de sede
              </h2>
              <p className="text-sm text-muted font-semibold">Cada admin gestiona únicamente su sede asignada.</p>
            </div>
            <Button
              className={BTN_SM}
              onClick={openCreateAdmin}
              disabled={data.sites.length === 0}
              title={data.sites.length === 0 ? "Primero creá una sede para poder asignarle un administrador." : undefined}
            >
              <UserCog size={18} /> Crear admin de sede
            </Button>
          </div>
          <AdminCards admins={filteredAdmins} />
        </section>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="absolute inset-0 bg-black/30 animate-overlay-fade" onClick={closeAdminModal} />
          <div className="glass-card-smooth relative max-h-[88vh] overflow-y-auto p-8 w-[min(30rem,92vw)] flex flex-col gap-5 animate-menu-reveal">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-accent/15 text-accent" aria-hidden="true">
              <UserCog size={24} />
            </span>
            <h2 id="admin-modal-title" className="font-display text-xl font-bold text-text">
              {editingAdminId ? "Editar admin de sede" : "Nuevo admin de sede"}
            </h2>
            <p className="text-muted font-semibold text-sm">
              {editingAdminId ? "Actualizá los datos y la sede asignada." : "Creá un administrador y asignalo a una sede."}
            </p>
            <form className="flex flex-col gap-4" onSubmit={submitAdmin}>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-text">Nombre completo</span>
                <input
                  required
                  className={INPUT_CLS}
                  placeholder="Nombre y apellido"
                  value={adminDraft.name}
                  onChange={(e) => setAdminDraft({ ...adminDraft, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-text">
                  Email <em className="text-rose text-xs font-bold not-italic">obligatorio</em>
                </span>
                <input
                  required
                  type="email"
                  className={INPUT_CLS}
                  placeholder="admin@colegio.edu"
                  value={adminDraft.email}
                  onChange={(e) => setAdminDraft({ ...adminDraft, email: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-text">
                  Sede asignada <em className="text-rose text-xs font-bold not-italic">obligatorio</em>
                </span>
                <select
                  required
                  className={SELECT_CLS}
                  value={adminDraft.siteId}
                  onChange={(e) => setAdminDraft({ ...adminDraft, siteId: e.target.value })}
                >
                  {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              {editingAdminId && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-md accent-accent-teal cursor-pointer"
                      checked={adminDraft.active}
                      onChange={(e) => setAdminDraft({ ...adminDraft, active: e.target.checked })}
                    />
                    <span className="text-sm font-semibold text-text">
                      {adminDraft.active ? "Cuenta activa" : "Cuenta desactivada"}
                    </span>
                  </label>
                  <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/40 border border-white/50">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-accent-strong cursor-pointer bg-transparent border-0 self-start"
                      onClick={doResetPassword}
                    >
                      <KeyRound size={16} /> Restablecer contraseña
                    </button>
                    {tempPassword ? (
                      <p className="text-sm text-text font-semibold">
                        Clave temporal: <code className="bg-white/50 px-1.5 py-0.5 rounded text-accent-teal">{tempPassword}</code>
                        <small className="block text-xs text-muted mt-1">Compartila una sola vez. Recomendá iniciar sesión con Google.</small>
                      </p>
                    ) : (
                      <small className="text-xs text-muted">Nunca se muestra la contraseña actual. Esto genera una nueva temporal.</small>
                    )}
                  </div>
                </>
              )}

              <Button type="submit" className={BTN_SM}>
                {editingAdminId ? <><Pencil size={16} /> Guardar cambios</> : <><Plus size={16} /> Crear admin</>}
              </Button>
              {editingAdminId && (
                <button
                  type="button"
                  className="text-sm font-bold text-rose hover:text-rose/80 cursor-pointer bg-transparent border-0 mt-2 self-start inline-flex items-center gap-1.5"
                  onClick={askDeleteCurrentAdmin}
                >
                  <Trash2 size={16} /> Eliminar admin
                </button>
              )}
            </form>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={closeAdminModal}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="absolute inset-0 bg-black/30 animate-overlay-fade" onClick={() => setConfirmDelete(null)} />
          <div className="glass-card-smooth relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col gap-5 animate-menu-reveal text-center">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-rose/15 text-rose mx-auto" aria-hidden="true">
              <Trash2 size={24} />
            </span>
            <h2 id="confirm-delete-title" className="font-display text-xl font-bold text-text">¿Eliminar admin?</h2>
            <p className="text-muted font-semibold text-sm">
              Vas a eliminar a <strong>{confirmDelete.name}</strong>. Esta acción no se puede deshacer.
              Si solo querés pausarlo, mejor desactivá la cuenta.
            </p>
            <div className="flex gap-3 mt-2 justify-center">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-rose text-white"
                onClick={confirmDeleteAdmin}
              >
                <Trash2 size={16} className="inline mr-1" /> Sí, eliminar
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-white/50 text-text"
                onClick={() => setConfirmDelete(null)}
              >
                Cancelar
              </button>
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setConfirmDelete(null)}
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
