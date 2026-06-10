import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Copy,
  Crown,
  Eye,
  GraduationCap,
  Home,
  ImagePlus,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  School,
  Send,
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
import { api, ApiError } from "../utils/api";
import { fileToResizedDataUrl } from "../utils/image";
import { assets } from "../utils/assets";
import { ImpersonateModal } from "../components/admin/ImpersonateModal";

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

const inviteStatusCls: Record<string, string> = {
  pending: "bg-accent-sky/20 text-accent-sky",
  sent: "bg-mint/20 text-accent-teal",
  accepted: "bg-mint/30 text-accent-teal",
  expired: "bg-muted/20 text-muted",
};

interface SiteDraft {
  name: string;
  city: string;
  photo: string;
}
const EMPTY_SITE: SiteDraft = { name: "", city: "", photo: "" };

interface AdminDraft {
  name: string;
  email: string;
  username: string;
  password: string;
  siteId: string;
  active: boolean;
}
const EMPTY_ADMIN: AdminDraft = { name: "", email: "", username: "", password: "", siteId: "", active: true };

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
  /* F6: toggle that re-fetches users with includeDeleted=1 so the
     superadmin can see + restore soft-deleted accounts. */
  const [showDeleted, setShowDeleted] = useState(false);
  const [impTarget, setImpTarget] = useState<{ id: string; name: string } | null>(null);

  /* Dedicated "invite admin de sede by email" flow (mirrors the teacher one). */
  const [invitations, setInvitations] = useState<
    Array<{ id: string; email: string; name?: string | null; role: string; status: string; createdAt: string }>
  >([]);
  const [inviteDraft, setInviteDraft] = useState({ email: "", name: "", siteId: "" });
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  /* F6: confirm-and-expire dialog for a single invitation (also see bulk button). */
  const [confirmExpireInv, setConfirmExpireInv] = useState<{ id: string; email: string } | null>(null);
  const [confirmExpireAll, setConfirmExpireAll] = useState(false);

  /* Live ecosystem state, loaded from the API (Postgres = source of truth). */
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<EduTicUser[]>([]);
  const [classes, setClasses] = useState<{ id: string; siteId: string }[]>([]);

  const reload = useCallback(async () => {
    try {
      const [s, u, c, inv] = await Promise.all([
        api.listSedes(),
        api.listUsers({ includeDeleted: showDeleted ? "1" : undefined } as any),
        api.listClasses(),
        api.listInvitations(),
      ]);
      setInvitations(inv);
      setSites(s.map((x) => ({ id: x.id, name: x.name, city: x.city, photo: x.photo ?? undefined, active: x.active })));
      setUsers(
        u.map((x) => ({
          id: x.id,
          name: x.fullName,
          username: x.username ?? "",
          email: x.email,
          role: x.role,
          siteId: x.sedeId ?? undefined,
          active: x.active,
          // F6: surface soft-delete state so the per-card Restaurar button works.
          ...(x as any).deletedAt ? { deletedAt: (x as any).deletedAt } : {},
        } as unknown as EduTicUser)),
      );
      setClasses(c.map((x) => ({ id: x.id, siteId: x.sedeId })));
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "No se pudieron cargar los datos.");
    }
  }, [showDeleted]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const data = useMemo(() => ({ sites, users, classes }), [sites, users, classes]);
  const counts = useMemo(
    () => ({
      sedes: sites.length,
      sedeAdmins: users.filter((u) => u.role === "admin-sede").length,
      teachers: users.filter((u) => u.role === "profesor").length,
      students: users.filter((u) => u.role === "alumno").length,
      classes: classes.length,
    }),
    [sites, users, classes],
  );

  function refresh(toast?: string) {
    setVersion((v) => v + 1);
    if (toast) setMessage(toast);
    void reload();
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
  async function submitSite(event: FormEvent) {
    event.preventDefault();
    try {
      if (editingSiteId) {
        await api.updateSede(editingSiteId, { name: siteDraft.name, city: siteDraft.city, photo: siteDraft.photo || undefined });
        refresh("Sede actualizada.");
      } else {
        const site = await api.createSede({ name: siteDraft.name, city: siteDraft.city, photo: siteDraft.photo || undefined });
        refresh(`Sede creada: ${site.name}`);
      }
      setShowSiteForm(false);
      setEditingSiteId("");
      setSiteDraft(EMPTY_SITE);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar la sede.");
    }
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
      username: admin.username ?? "",
      password: "",
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
  async function submitAdmin(event: FormEvent) {
    event.preventDefault();
    if (!adminDraft.email.trim()) {
      setMessage("El email del administrador es obligatorio.");
      return;
    }
    if (!adminDraft.siteId) {
      setMessage("Elegí una sede para el administrador.");
      return;
    }
    if (adminDraft.password && adminDraft.password.length < 6) {
      setMessage("La contraseña debe tener al menos 6 caracteres (o dejala vacía para una temporal).");
      return;
    }
    try {
      if (editingAdminId) {
        await api.updateUser(editingAdminId, {
          fullName: adminDraft.name,
          email: adminDraft.email,
          username: adminDraft.username.trim() || undefined,
          sedeId: adminDraft.siteId,
          active: adminDraft.active,
        });
        closeAdminModal();
        refresh("Admin de sede actualizado.");
      } else {
        const res = await api.createUser({
          fullName: adminDraft.name,
          email: adminDraft.email,
          role: "admin-sede",
          sedeId: adminDraft.siteId,
          username: adminDraft.username || undefined,
          password: adminDraft.password || undefined,
        });
        closeAdminModal();
        refresh(
          res.temporaryPassword
            ? `Admin creado · usuario ${res.user.username ?? adminDraft.email} · clave temporal ${res.temporaryPassword}`
            : `Admin creado · usuario ${res.user.username ?? adminDraft.email} · ya puede iniciar sesión con la contraseña elegida`,
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar el admin.");
    }
  }
  /** Invite the admin by email instead of creating them directly — they set
   *  their own password from the link. */
  async function inviteAdmin() {
    if (!adminDraft.email.trim()) {
      setMessage("Ingresá el email para enviar la invitación.");
      return;
    }
    if (!adminDraft.siteId) {
      setMessage("Elegí una sede para el administrador.");
      return;
    }
    try {
      const res = await api.createInvitation({
        email: adminDraft.email,
        name: adminDraft.name || undefined,
        role: "admin-sede",
        sedeId: adminDraft.siteId,
      });
      closeAdminModal();
      refresh(
        res.emailed
          ? `Invitación enviada a ${res.invitation.email}`
          : "Invitación creada. Copiá el enlace para compartirlo.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo enviar la invitación.");
    }
  }
  /* Dedicated invite form (Admins section). Same mechanism as teacher invites. */
  async function submitSuperInvite(event: FormEvent) {
    event.preventDefault();
    const siteId = inviteDraft.siteId || data.sites[0]?.id || "";
    if (!inviteDraft.email.trim()) {
      setMessage("Ingresá el email del admin a invitar.");
      return;
    }
    if (!siteId) {
      setMessage("Elegí una sede.");
      return;
    }
    try {
      const res = await api.createInvitation({
        email: inviteDraft.email,
        name: inviteDraft.name || undefined,
        role: "admin-sede",
        sedeId: siteId,
      });
      setInviteDraft({ email: "", name: "", siteId });
      setInviteLinks((prev) => ({ ...prev, [res.invitation.id]: res.link }));
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
      setMessage(err instanceof Error ? err.message : "No se pudo enviar la invitación.");
    }
  }
  async function copyAdminInviteLink(id: string) {
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
  async function doResetPassword() {
    if (!editingAdminId) return;
    try {
      const res = await api.resetUserPassword(editingAdminId);
      setTempPassword(res.temporaryPassword);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.");
    }
  }
  function askDeleteCurrentAdmin() {
    if (!editingAdminId) return;
    setConfirmDelete({ id: editingAdminId, name: adminDraft.name || "este admin" });
  }
  async function confirmDeleteAdmin() {
    if (!confirmDelete) return;
    try {
      await api.deleteUser(confirmDelete.id);
      setConfirmDelete(null);
      closeAdminModal();
      refresh("Admin de sede eliminado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo eliminar el admin.");
    }
  }
  /* F6: invitations — expire a single one or every pending one. */
  async function doExpireInvitation() {
    if (!confirmExpireInv) return;
    try {
      await api.expireInvitation(confirmExpireInv.id);
      setConfirmExpireInv(null);
      refresh(`Invitación de ${confirmExpireInv.email} expirada.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo expirar la invitación.");
    }
  }
  async function doExpireAll() {
    try {
      const res = await api.expireAllInvitations();
      setConfirmExpireAll(false);
      refresh(`${res.expired} invitación(es) expiradas.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo expirar las invitaciones.");
    }
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
        {admins.map((admin) => {
          const isDeleted = !!(admin as any).deletedAt;
          return (
            <div
              key={admin.id}
              className={`glass-surface flex items-center gap-3 p-4 animate-card-in ${admin.active === false || isDeleted ? "opacity-60" : ""}`}
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
                  isDeleted
                    ? "bg-rose/70"
                    : admin.active === false
                    ? "bg-muted/60"
                    : "bg-mint"
                }`}
              >
                {isDeleted ? "Borrado" : admin.active === false ? "Inactivo" : "Activo"}
              </span>
              {!isDeleted && (
                <button
                  type="button"
                  className="grid place-items-center w-8 h-8 rounded-full bg-amber-100/70 text-amber-700 hover:bg-amber-200 cursor-pointer border-0 transition-colors shrink-0"
                  aria-label={`Ver ${admin.name} en modo lectura`}
                  title="Ver en modo lectura"
                  onClick={() => setImpTarget({ id: admin.id, name: admin.name })}
                >
                  <Eye size={16} />
                </button>
              )}
              <button
                type="button"
                className="grid place-items-center w-8 h-8 rounded-full bg-white/40 text-text/60 hover:text-text hover:bg-white/70 cursor-pointer border-0 transition-colors shrink-0"
                aria-label={`Editar ${admin.name}`}
                onClick={() => openEditAdmin(admin)}
              >
                <Pencil size={16} />
              </button>
              {isDeleted ? (
                <button
                  type="button"
                  className="grid place-items-center px-2 h-8 rounded-full bg-mint/20 text-mint hover:text-white hover:bg-mint cursor-pointer border-0 transition-colors shrink-0 text-[10px] font-black uppercase tracking-wide"
                  aria-label={`Restaurar ${admin.name}`}
                  title="Restaurar"
                  onClick={async () => {
                    try {
                      await api.restoreUser(admin.id);
                      refresh("Cuenta restaurada.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "No se pudo restaurar.");
                    }
                  }}
                >
                  Restaurar
                </button>
              ) : (
                <button
                  type="button"
                  className="grid place-items-center w-8 h-8 rounded-full bg-white/40 text-rose/80 hover:text-white hover:bg-rose cursor-pointer border-0 transition-colors shrink-0"
                  aria-label={`Borrar cuenta de ${admin.name}`}
                  title="Borrar cuenta"
                  onClick={() => setConfirmDelete({ id: admin.id, name: admin.name })}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
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
          <SedeCards sites={filteredSites} />
        </section>
      )}

      {/* Crear/editar sede — modal dedicado (nunca un formulario incrustado
          en la misma lista, para no romper la jerarquía visual). */}
      {showSiteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="site-modal-title">
          <div className="modal-overlay animate-overlay-fade" onClick={() => setShowSiteForm(false)} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(34rem,92vw)] flex flex-col gap-5 animate-menu-reveal">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-mint/20 text-mint" aria-hidden="true">
              <School size={24} />
            </span>
            <h2 id="site-modal-title" className="font-display text-xl font-bold text-text">
              {editingSiteId ? "Editar sede" : "Nueva sede"}
            </h2>
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
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setShowSiteForm(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
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
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm font-semibold text-muted cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-accent-teal"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                Mostrar borrados
              </label>
              <Button
                className={BTN_SM}
                onClick={openCreateAdmin}
                disabled={data.sites.length === 0}
                title={data.sites.length === 0 ? "Primero creá una sede para poder asignarle un administrador." : undefined}
              >
                <UserCog size={18} /> Crear admin de sede
              </Button>
            </div>
          </div>
          <AdminCards admins={filteredAdmins} />

          {/* Invitar admin de sede por email — mismo flujo que invitar docente. */}
          <div className="mt-2 pt-5 border-t border-white/40 flex flex-col gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-text flex items-center gap-2">
                <Mail size={20} /> Invitar admin de sede por email
              </h3>
              <p className="text-sm text-muted font-semibold">
                El admin recibe un enlace y elige su propia contraseña. (También podés crearlo con usuario y contraseña desde "Crear admin de sede".)
              </p>
            </div>
            <form className="flex flex-row flex-wrap items-end gap-4" onSubmit={submitSuperInvite}>
              <input
                required
                type="email"
                className={`${INPUT_CLS} flex-1 min-w-[12rem]`}
                placeholder="Email del admin"
                value={inviteDraft.email}
                onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
              />
              <input
                className={`${INPUT_CLS} flex-1 min-w-[10rem]`}
                placeholder="Nombre (opcional)"
                value={inviteDraft.name}
                onChange={(e) => setInviteDraft({ ...inviteDraft, name: e.target.value })}
              />
              <select
                required
                className={`${SELECT_CLS} flex-1 min-w-[10rem]`}
                value={inviteDraft.siteId || data.sites[0]?.id || ""}
                onChange={(e) => setInviteDraft({ ...inviteDraft, siteId: e.target.value })}
              >
                {data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button type="submit" className={BTN_SM} disabled={data.sites.length === 0}>
                <Send size={18} /> Invitar
              </Button>
            </form>
            {invitations.filter((i) => i.role === "admin-sede").length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-sm font-bold text-text">Invitaciones pendientes y enviadas</h4>
                  {invitations.some((i) => i.role === "admin-sede" && (i.status === "pending" || i.status === "sent")) && (
                    <Button
                      type="button"
                      variant="secondary"
                      className={BTN_SM}
                      onClick={() => setConfirmExpireAll(true)}
                    >
                      <Trash2 size={15} /> Expirar todas
                    </Button>
                  )}
                </div>
                {invitations
                  .filter((i) => i.role === "admin-sede")
                  .map((inv) => {
                    const canExpire = inv.status === "pending" || inv.status === "sent";
                    return (
                      <div key={inv.id} className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-white/40">
                        <span className="flex items-center gap-2 text-sm font-semibold text-text min-w-0 flex-1">
                          <Mail size={16} className="shrink-0" /> {inv.email}
                        </span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${inviteStatusCls[inv.status] ?? "bg-white/40 text-muted"}`}>
                          {inv.status}
                        </span>
                        <Button variant="secondary" className={BTN_SM} onClick={() => copyAdminInviteLink(inv.id)}>
                          <Copy size={16} /> Copiar enlace
                        </Button>
                        {canExpire && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-rose hover:text-rose/80 cursor-pointer bg-transparent border-0"
                            onClick={() => setConfirmExpireInv({ id: inv.id, email: inv.email })}
                            title="Expirar esta invitación"
                          >
                            <Trash2 size={15} /> Expirar
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="modal-overlay animate-overlay-fade" onClick={closeAdminModal} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(30rem,92vw)] flex flex-col gap-5 animate-menu-reveal">
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

              {!editingAdminId && (
                <div className="flex flex-col gap-4 p-4 rounded-xl bg-white/40 border border-white/50">
                  <p className="text-xs text-muted font-semibold">
                    Opcional: definí usuario y contraseña ahora, o dejalos vacíos y usá <b>Invitar por email</b> para que el admin elija su propia contraseña.
                  </p>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-text">Usuario (opcional)</span>
                    <input
                      className={INPUT_CLS}
                      placeholder="se genera automático si lo dejás vacío"
                      value={adminDraft.username}
                      onChange={(e) => setAdminDraft({ ...adminDraft, username: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-text">Contraseña (opcional)</span>
                    <input
                      type="text"
                      className={INPUT_CLS}
                      placeholder="mín. 6 — vacío = clave temporal"
                      value={adminDraft.password}
                      onChange={(e) => setAdminDraft({ ...adminDraft, password: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {editingAdminId && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-bold text-text">Usuario</span>
                    <input
                      className={INPUT_CLS}
                      placeholder="usuario de ingreso"
                      value={adminDraft.username}
                      onChange={(e) => setAdminDraft({ ...adminDraft, username: e.target.value })}
                    />
                  </label>
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

              <div className="flex flex-wrap gap-3">
                <Button type="submit" className={BTN_SM}>
                  {editingAdminId ? <><Pencil size={16} /> Guardar cambios</> : <><Plus size={16} /> Crear admin</>}
                </Button>
                {!editingAdminId && (
                  <Button type="button" variant="secondary" className={BTN_SM} onClick={inviteAdmin}>
                    <UserCog size={16} /> Invitar por email
                  </Button>
                )}
              </div>
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

      {confirmExpireInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="expire-inv-title">
          <div className="modal-overlay animate-overlay-fade" onClick={() => setConfirmExpireInv(null)} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col gap-5 animate-menu-reveal text-center">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-rose/15 text-rose mx-auto" aria-hidden="true">
              <Trash2 size={24} />
            </span>
            <h2 id="expire-inv-title" className="font-display text-xl font-bold text-text">¿Expirar invitación?</h2>
            <p className="text-muted font-semibold text-sm">
              Vas a invalidar el enlace enviado a <strong>{confirmExpireInv.email}</strong>. La persona ya no podrá aceptarlo.
            </p>
            <div className="flex gap-3 mt-2 justify-center">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-rose text-white"
                onClick={doExpireInvitation}
              >
                <Trash2 size={16} className="inline mr-1" /> Sí, expirar
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-white/50 text-text"
                onClick={() => setConfirmExpireInv(null)}
              >
                Cancelar
              </button>
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setConfirmExpireInv(null)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {confirmExpireAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="expire-all-title">
          <div className="modal-overlay animate-overlay-fade" onClick={() => setConfirmExpireAll(false)} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col gap-5 animate-menu-reveal text-center">
            <span className="grid place-items-center w-12 h-12 rounded-full bg-rose/15 text-rose mx-auto" aria-hidden="true">
              <Trash2 size={24} />
            </span>
            <h2 id="expire-all-title" className="font-display text-xl font-bold text-text">¿Expirar todas las invitaciones?</h2>
            <p className="text-muted font-semibold text-sm">
              Vas a invalidar todos los enlaces pendientes y enviados a admins de sede. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 mt-2 justify-center">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-rose text-white"
                onClick={doExpireAll}
              >
                <Trash2 size={16} className="inline mr-1" /> Sí, expirar todas
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl font-extrabold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] bg-white/50 text-text"
                onClick={() => setConfirmExpireAll(false)}
              >
                Cancelar
              </button>
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
              aria-label="Cerrar"
              onClick={() => setConfirmExpireAll(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <div className="modal-overlay animate-overlay-fade" onClick={() => setConfirmDelete(null)} />
          <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(24rem,90vw)] flex flex-col gap-5 animate-menu-reveal text-center">
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

      {impTarget && <ImpersonateModal target={impTarget} onClose={() => setImpTarget(null)} />}

      <Toast message={message} />
    </DashboardShell>
  );
}
