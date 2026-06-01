import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Crown,
  GraduationCap,
  Home,
  Plus,
  School,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import type { Site } from "../types";
import {
  createSedeAdmin,
  createSite,
  getDemoData,
  getEcosystemCounts,
  updateSite,
} from "../utils/storage";
import { assets } from "../utils/assets";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "sedes", label: "Sedes", icon: School },
  { id: "admins", label: "Admins de sede", icon: ShieldCheck },
];

const SEDE_ART = [
  assets.worldsIsland1,
  assets.worldsIsland2,
  assets.worldsIsland3,
  assets.worldsIsland4,
  assets.worldsIsland5,
];

export function AdminGeneralPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState("inicio");
  const [search, setSearch] = useState("");
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState("");

  const [showSiteForm, setShowSiteForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState("");
  const [siteDraft, setSiteDraft] = useState({ name: "", city: "", coordinator: "" });

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminDraft, setAdminDraft] = useState({ name: "", email: "", siteId: "" });

  const data = useMemo(() => getDemoData(), [message]);
  const counts = useMemo(() => getEcosystemCounts(), [message]);

  function refresh(toast?: string) {
    setVersion((v) => v + 1);
    if (toast) setMessage(toast);
  }

  function submitSite(event: FormEvent) {
    event.preventDefault();
    if (editingSiteId) {
      updateSite(editingSiteId, siteDraft);
      refresh("Sede actualizada.");
    } else {
      const site = createSite(siteDraft);
      refresh(`Sede creada: ${site.name}`);
    }
    setShowSiteForm(false);
    setEditingSiteId("");
    setSiteDraft({ name: "", city: "", coordinator: "" });
  }

  function startCreateSite() {
    setSection("sedes");
    setEditingSiteId("");
    setSiteDraft({ name: "", city: "", coordinator: "" });
    setShowSiteForm(true);
  }
  function startEditSite(site: Site) {
    setEditingSiteId(site.id);
    setSiteDraft({ name: site.name, city: site.city, coordinator: site.coordinator });
    setShowSiteForm(true);
  }
  function openAdminModal() {
    setAdminDraft({ name: "", email: "", siteId: data.sites[0]?.id ?? "" });
    setShowAdminModal(true);
  }
  function submitAdmin(event: FormEvent) {
    event.preventDefault();
    if (!adminDraft.siteId) {
      setMessage("Elegí una sede para el administrador.");
      return;
    }
    const admin = createSedeAdmin(adminDraft);
    setShowAdminModal(false);
    refresh(`Admin de sede creado: ${admin.username} / ${admin.password}`);
  }

  function leave() {
    logout();
    navigate("/login");
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
          <Button onClick={startCreateSite}>
            <Plus size={18} /> Crear sede
          </Button>
        </div>
      );
    }
    return (
      <div className="sede-grid">
        {sites.map((site, i) => (
          <div key={site.id} className="sede-card">
            <div className="sede-card__media">
              <span className="sede-card__status">Activa</span>
              <img src={SEDE_ART[i % SEDE_ART.length]} alt="" decoding="async" loading="lazy" />
            </div>
            <div className="sede-card__body">
              <strong>{site.name}</strong>
              <span>{site.city}</span>
              <div className="sede-card__stats">
                <span><Users size={15} /> {countFor(site.id, "alumno")}</span>
                <span><GraduationCap size={15} /> {countFor(site.id, "profesor")}</span>
                <span><Building2 size={15} /> {classesFor(site.id)}</span>
              </div>
              <Button className="sede-card__edit" variant="secondary" onClick={() => startEditSite(site)}>
                Editar sede
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function AdminCards({ admins }: { admins: typeof sedeAdmins }) {
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
          <div key={admin.id} className="people-card">
            <span className="people-card__avatar">
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>{admin.name}</strong>
              <span>{admin.email ?? admin.username}</span>
              <small>{siteName(admin.siteId)}</small>
            </div>
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
      <p>Gestioná todas las sedes, sus administradores y el ecosistema Typely desde un solo lugar.</p>
      <div className="dash-hero__actions">
        <Button onClick={startCreateSite}>
          <Plus size={18} /> Crear sede
        </Button>
        <Button variant="secondary" onClick={openAdminModal} disabled={data.sites.length === 0}>
          <UserCog size={18} /> Crear admin de sede
        </Button>
      </div>
    </>
  );

  return (
    <DashboardShell
      accent="violet"
      roleLabel="SUPERADMIN"
      roleSubtitle="Acceso total"
      roleIcon={Crown}
      account={{ name: user?.name ?? "Superadmin", email: user?.email ?? "superadmin@typely.com", initial: "S" }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId={section}
      onNavigate={setSection}
      onLogout={leave}
      search={{ value: search, onChange: setSearch, placeholder: "Buscar sedes, admins…" }}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      bellCount={0}
      hero={hero}
      heroArt={{ mascot: assets.mascotMaleProud, island: assets.worldsIsland1 }}
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
              <p>Escuelas y coordinaciones del ecosistema.</p>
            </div>
            <Button onClick={startCreateSite}>
              <Plus size={18} /> Crear sede
            </Button>
          </div>
          {showSiteForm && (
            <form className="admin-form admin-form--inline" onSubmit={submitSite}>
              <input required placeholder="Nombre de la sede" value={siteDraft.name} onChange={(e) => setSiteDraft({ ...siteDraft, name: e.target.value })} />
              <input placeholder="Ciudad" value={siteDraft.city} onChange={(e) => setSiteDraft({ ...siteDraft, city: e.target.value })} />
              <input placeholder="Coordinación" value={siteDraft.coordinator} onChange={(e) => setSiteDraft({ ...siteDraft, coordinator: e.target.value })} />
              <div className="admin-form__actions">
                <Button type="submit">{editingSiteId ? "Guardar" : "Crear sede"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowSiteForm(false)}>Cancelar</Button>
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
            <Button onClick={openAdminModal} disabled={data.sites.length === 0}>
              <UserCog size={18} /> Crear admin de sede
            </Button>
          </div>
          <AdminCards admins={filteredAdmins} />
        </section>
      )}

      {showAdminModal && (
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="demo-modal__backdrop" onClick={() => setShowAdminModal(false)} />
          <div className="demo-modal__card admin-modal__card">
            <span className="demo-modal__icon" aria-hidden="true"><UserCog size={26} /></span>
            <h2 id="admin-modal-title">Nuevo admin de sede</h2>
            <p>Creá un administrador y asignalo a una sede.</p>
            <form className="admin-form" onSubmit={submitAdmin}>
              <input required placeholder="Nombre completo" value={adminDraft.name} onChange={(e) => setAdminDraft({ ...adminDraft, name: e.target.value })} />
              <input type="email" placeholder="Email (opcional)" value={adminDraft.email} onChange={(e) => setAdminDraft({ ...adminDraft, email: e.target.value })} />
              <select value={adminDraft.siteId} onChange={(e) => setAdminDraft({ ...adminDraft, siteId: e.target.value })}>
                {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button type="submit"><Plus size={18} /> Crear admin</Button>
            </form>
            <button type="button" className="demo-modal__close" aria-label="Cerrar" onClick={() => setShowAdminModal(false)}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <Toast message={message} />
    </DashboardShell>
  );
}
