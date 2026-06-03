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
    <div className="kpi-grid">
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
        <div className="empty-state">
          <img src={assets.mascotFemaleLaptop} alt="" decoding="async" />
          <h3>Todavía no hay sedes</h3>
          <p>Creá tu primera sede para empezar a construir el ecosistema Typely.</p>
          <Button className="button--sm" onClick={startCreateSite}>
            <Plus size={18} /> Crear sede
          </Button>
        </div>
      );
    }
    return (
      <div className="sede-grid">
        {sites.map((site) => (
          <div key={site.id} className="sede-card">
            <div className="sede-card__media">
              <span className={`sede-card__status ${site.active === false ? "is-off" : ""}`}>
                {site.active === false ? "Inactiva" : "Activa"}
              </span>
              {site.photo ? (
                <img className="sede-card__photo" src={site.photo} alt={`Foto de ${site.name}`} decoding="async" loading="lazy" />
              ) : (
                <span className="sede-card__placeholder" aria-hidden="true">
                  <School size={30} />
                  <small>Sin foto del colegio</small>
                </span>
              )}
            </div>
            <div className="sede-card__body">
              <strong>{site.name}</strong>
              <span>{site.city}</span>
              <div className="sede-card__stats">
                <span><Users size={15} /> {countFor(site.id, "alumno")}</span>
                <span><GraduationCap size={15} /> {countFor(site.id, "profesor")}</span>
                <span><Building2 size={15} /> {classesFor(site.id)}</span>
              </div>
              <Button className="sede-card__edit button--sm" variant="secondary" onClick={() => startEditSite(site)}>
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
        <div className="empty-state empty-state--compact">
          <h3>Sin administradores de sede</h3>
          <p>
            {data.sites.length === 0
              ? "Primero creá una sede, luego asignale un administrador."
              : "Creá un administrador y asignalo a una de tus sedes."}
          </p>
        </div>
      );
    }
    return (
      <div className="people-card-grid">
        {admins.map((admin) => (
          <div key={admin.id} className={`people-card ${admin.active === false ? "is-off" : ""}`}>
            <span className="people-card__avatar">
              <ShieldCheck size={20} />
            </span>
            <div className="people-card__main">
              <strong>{admin.name}</strong>
              <span>{admin.email ?? admin.username}</span>
              <small>{siteName(admin.siteId)}</small>
            </div>
            <span className={`people-card__pill ${admin.active === false ? "is-off" : ""}`}>
              {admin.active === false ? "Inactivo" : "Activo"}
            </span>
            <button type="button" className="people-card__edit" aria-label={`Editar ${admin.name}`} onClick={() => openEditAdmin(admin)}>
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }

  const hero = (
    <>
      <span className="dash-eyebrow">
        <Crown size={18} /> ¡Bienvenido, Superadmin!
      </span>
      <h1>
        Panel <span className="grad">Superadmin</span>
      </h1>
      <p>Gestioná las sedes y sus administradores del ecosistema Typely desde un solo lugar.</p>
      <div className="dash-hero__actions">
        <Button className="button--sm" onClick={startCreateSite}>
          <Plus size={18} /> Crear sede
        </Button>
        <Button
          className="button--sm"
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
          <section className="dash-section">
            <div className="dash-section__head">
              <h2><School size={22} /> Sedes activas</h2>
              <button type="button" className="link-arrow" onClick={() => setSection("sedes")}>
                Ver todas <ArrowRight size={16} />
              </button>
            </div>
            <SedeCards sites={data.sites.slice(0, 4)} />
          </section>
          <section className="dash-section">
            <div className="dash-section__head">
              <h2><ShieldCheck size={22} /> Administradores de sede</h2>
              <button type="button" className="link-arrow" onClick={() => setSection("admins")}>
                Ver todos <ArrowRight size={16} />
              </button>
            </div>
            <AdminCards admins={sedeAdmins.slice(0, 6)} />
          </section>
        </>
      )}

      {section === "sedes" && (
        <section className="dash-section">
          <div className="dash-section__head">
            <div>
              <h2><School size={22} /> Sedes</h2>
              <p>Colegios y campus del ecosistema.</p>
            </div>
            <Button className="button--sm" onClick={startCreateSite}>
              <Plus size={18} /> Crear sede
            </Button>
          </div>
          {showSiteForm && (
            <form className="admin-form sede-form" onSubmit={submitSite}>
              <div className="sede-form__fields">
                <label className="field">
                  <span>Nombre de la sede</span>
                  <input required placeholder="Colegio San Martín" value={siteDraft.name} onChange={(e) => setSiteDraft({ ...siteDraft, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Ciudad / ubicación</span>
                  <input placeholder="Buenos Aires" value={siteDraft.city} onChange={(e) => setSiteDraft({ ...siteDraft, city: e.target.value })} />
                </label>
              </div>
              <div className="sede-form__photo">
                <div className={`photo-preview ${siteDraft.photo ? "has-img" : ""}`}>
                  {siteDraft.photo ? (
                    <img src={siteDraft.photo} alt="Vista previa de la sede" />
                  ) : (
                    <span className="photo-preview__empty"><School size={26} /><small>Sin foto</small></span>
                  )}
                </div>
                <div className="sede-form__photo-actions">
                  <label className="photo-upload button button--secondary button--sm">
                    <ImagePlus size={16} /> {siteDraft.photo ? "Cambiar foto" : "Subir foto del colegio"}
                    <input type="file" accept="image/*" onChange={onPhotoPick} hidden />
                  </label>
                  {siteDraft.photo && (
                    <button type="button" className="photo-remove" onClick={() => setSiteDraft({ ...siteDraft, photo: "" })}>
                      <Trash2 size={15} /> Quitar
                    </button>
                  )}
                  <small className="photo-hint">JPG o PNG. Se ajusta automáticamente.</small>
                </div>
              </div>
              <div className="admin-form__actions">
                <Button type="submit" className="button--sm">{editingSiteId ? "Guardar cambios" : "Crear sede"}</Button>
                <Button type="button" variant="ghost" className="button--sm" onClick={() => setShowSiteForm(false)}>Cancelar</Button>
              </div>
            </form>
          )}
          <SedeCards sites={filteredSites} />
        </section>
      )}

      {section === "admins" && (
        <section className="dash-section">
          <div className="dash-section__head">
            <div>
              <h2><ShieldCheck size={22} /> Administradores de sede</h2>
              <p>Cada admin gestiona únicamente su sede asignada.</p>
            </div>
            <Button
              className="button--sm"
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
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="demo-modal__backdrop" onClick={closeAdminModal} />
          <div className="demo-modal__card admin-modal__card">
            <span className="demo-modal__icon" aria-hidden="true"><UserCog size={24} /></span>
            <h2 id="admin-modal-title">{editingAdminId ? "Editar admin de sede" : "Nuevo admin de sede"}</h2>
            <p>{editingAdminId ? "Actualizá los datos y la sede asignada." : "Creá un administrador y asignalo a una sede."}</p>
            <form className="admin-form" onSubmit={submitAdmin}>
              <label className="field">
                <span>Nombre completo</span>
                <input required placeholder="Nombre y apellido" value={adminDraft.name} onChange={(e) => setAdminDraft({ ...adminDraft, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Email <em className="req">obligatorio</em></span>
                <input required type="email" placeholder="admin@colegio.edu" value={adminDraft.email} onChange={(e) => setAdminDraft({ ...adminDraft, email: e.target.value })} />
              </label>
              <label className="field">
                <span>Sede asignada <em className="req">obligatorio</em></span>
                <select required value={adminDraft.siteId} onChange={(e) => setAdminDraft({ ...adminDraft, siteId: e.target.value })}>
                  {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              {editingAdminId && (
                <>
                  <label className="switch-row">
                    <input type="checkbox" checked={adminDraft.active} onChange={(e) => setAdminDraft({ ...adminDraft, active: e.target.checked })} />
                    <span>{adminDraft.active ? "Cuenta activa" : "Cuenta desactivada"}</span>
                  </label>
                  <div className="reset-box">
                    <button type="button" className="reset-box__btn" onClick={doResetPassword}>
                      <KeyRound size={16} /> Restablecer contraseña
                    </button>
                    {tempPassword ? (
                      <p className="reset-box__result">
                        Clave temporal: <code>{tempPassword}</code>
                        <small>Compartila una sola vez. Recomendá iniciar sesión con Google.</small>
                      </p>
                    ) : (
                      <small className="reset-box__hint">Nunca se muestra la contraseña actual. Esto genera una nueva temporal.</small>
                    )}
                  </div>
                </>
              )}

              <Button type="submit" className="button--sm">
                {editingAdminId ? <><Pencil size={16} /> Guardar cambios</> : <><Plus size={16} /> Crear admin</>}
              </Button>
              {editingAdminId && (
                <button type="button" className="admin-form__delete" onClick={askDeleteCurrentAdmin}>
                  <Trash2 size={16} /> Eliminar admin
                </button>
              )}
            </form>
            <button type="button" className="demo-modal__close" aria-label="Cerrar" onClick={closeAdminModal}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="demo-modal__backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="demo-modal__card confirm-card">
            <span className="demo-modal__icon demo-modal__icon--danger" aria-hidden="true"><Trash2 size={24} /></span>
            <h2 id="confirm-delete-title">¿Eliminar admin?</h2>
            <p>
              Vas a eliminar a <strong>{confirmDelete.name}</strong>. Esta acción no se puede deshacer.
              Si solo querés pausarlo, mejor desactivá la cuenta.
            </p>
            <div className="demo-modal__actions confirm-card__actions">
              <button type="button" className="demo-modal__btn demo-modal__btn--danger" onClick={confirmDeleteAdmin}>
                <Trash2 size={16} /> Sí, eliminar
              </button>
              <button type="button" className="demo-modal__btn demo-modal__btn--ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
            </div>
            <button type="button" className="demo-modal__close" aria-label="Cerrar" onClick={() => setConfirmDelete(null)}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
