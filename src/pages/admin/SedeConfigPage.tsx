import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Settings, Calendar, BookOpen, Archive, AlertTriangle, Download, Search, Shield,
} from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";
import { DataTable } from "../../components/admin/DataTable";
import { useAuth } from "../../hooks/useAuth";
import { api, type AcademicYear, type AuditEntry, type ApiClass } from "../../utils/api";
import { Button } from "../../components/common/Button";
import { Toast } from "../../components/common/Toast";
import { CloseYearWizard } from "./CloseYearWizard";
import { relTime } from "./TeachersListPage";

type Tab = "general" | "year" | "audit" | "danger";

const ACTION_LABELS: Record<string, string> = {
  create_user: "Creó usuario",
  delete_user: "Eliminó usuario",
  restore_user: "Restauró usuario",
  reset_password: "Restableció contraseña",
  create_invitation: "Envió invitación",
  expire_invitation: "Expiró invitación",
  expire_all_invitations: "Expiró todas las invitaciones",
  create_class: "Creó curso",
  delete_class: "Eliminó curso",
  archive_class: "Archivó curso",
  reactivate_class: "Reactivó curso",
  create_academic_year: "Creó año lectivo",
  activate_academic_year: "Activó año lectivo",
  close_academic_year: "Cerró año lectivo",
};

const ENTITY_LABELS: Record<string, string> = {
  user: "usuario",
  class: "curso",
  sede: "sede",
  invitation: "invitación",
  academic_year: "año lectivo",
  enrollment: "matrícula",
};

/* F6 Config page — replaces the F1 stub. Four tabs:
   - General      (sede info placeholder for now; logo, name — out of scope here)
   - Año lectivo  (create / activate / close year, archived courses)
   - Auditoría    (DataTable of every privileged action with CSV export)
   - Zona peligrosa (delete-sede placeholder, superadmin only)
*/
export function ConfigPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("general");
  const [msg, setMsg] = useState("");

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [archivedClasses, setArchivedClasses] = useState<ApiClass[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState("");

  const [creatingYear, setCreatingYear] = useState(false);
  const [newYearLabel, setNewYearLabel] = useState("");
  const [wizardYear, setWizardYear] = useState<AcademicYear | null>(null);

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(""), 2600); };

  const reload = useCallback(async () => {
    try {
      const sedeId = user?.siteId ?? undefined;
      const [ys, ac, au] = await Promise.all([
        api.listAcademicYears(sedeId),
        api.listClasses(sedeId, true).catch(() => [] as ApiClass[]),
        api.listAudit({ sedeId, limit: 200 }).catch(() => [] as AuditEntry[]),
      ]);
      setYears(ys);
      setArchivedClasses(ac.filter((c) => (c as any).status === "archived"));
      setAudit(au);
    } catch { /* keep empty */ }
  }, [user?.siteId]);

  useEffect(() => { void reload(); }, [reload]);

  const activeYear = useMemo(() => years.find((y) => y.isActive) ?? null, [years]);

  async function createYear() {
    if (!newYearLabel.trim()) return;
    setCreatingYear(true);
    try {
      await api.createAcademicYear({ label: newYearLabel.trim() });
      setNewYearLabel("");
      flash(`Año ${newYearLabel} creado.`);
      await reload();
    } catch (e: any) {
      flash(e?.message ?? "No se pudo crear el año.");
    } finally { setCreatingYear(false); }
  }
  async function activateYear(id: string) {
    try { await api.activateAcademicYear(id); flash("Año activado."); await reload(); }
    catch (e: any) { flash(e?.message ?? "No se pudo activar."); }
  }
  async function reactivateClass(id: string) {
    try { await api.reactivateClass(id); flash("Curso reactivado."); await reload(); }
    catch (e: any) { flash(e?.message ?? "No se pudo reactivar."); }
  }

  function exportAuditCsv() {
    const header = ["Fecha", "Actor", "Acción", "Entidad", "ID", "Detalle"];
    const rows = audit.map((e) => [
      new Date(e.at).toISOString(),
      e.actorName ?? "—",
      ACTION_LABELS[e.action] ?? e.action,
      ENTITY_LABELS[e.entityType] ?? e.entityType,
      e.entityId ?? "",
      e.meta ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const auditRows = useMemo(() => {
    const q = auditFilter.trim().toLowerCase();
    if (!q) return audit;
    return audit.filter((e) => {
      return (
        (ACTION_LABELS[e.action] ?? e.action).toLowerCase().includes(q) ||
        (ENTITY_LABELS[e.entityType] ?? e.entityType).toLowerCase().includes(q) ||
        (e.actorName ?? "").toLowerCase().includes(q) ||
        (e.entityId ?? "").toLowerCase().includes(q) ||
        (e.meta ?? "").toLowerCase().includes(q)
      );
    });
  }, [audit, auditFilter]);

  const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "year", label: "Año lectivo", icon: Calendar },
    { id: "audit", label: "Auditoría", icon: Shield },
    { id: "danger", label: "Zona peligrosa", icon: AlertTriangle },
  ];

  return (
    <SedeShell
      active="config"
      hero={
        <div>
          <h1 className="font-display font-black text-2xl text-text">Configuración de la sede</h1>
          <p className="text-muted font-semibold text-sm">Año lectivo, auditoría y herramientas avanzadas.</p>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1 glass-surface p-1 rounded-xl self-start">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition cursor-pointer ${
              tab === id ? "bg-white text-text shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <section className="glass-card-smooth rounded-2xl p-6 flex flex-col gap-3 max-w-2xl">
          <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Settings size={18} /> General</h2>
          <p className="text-muted font-semibold text-sm">
            Datos básicos de la sede. La edición completa de nombre, logo y ciudad vive en el panel
            del superadmin (cada sede se crea allí). Acá podés ver el resumen.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/40">
              <span className="text-sm font-bold text-text">Año lectivo activo</span>
              <span className="text-sm font-extrabold text-accent-teal">{activeYear?.label ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/40">
              <span className="text-sm font-bold text-text">Cursos activos</span>
              <span className="text-sm font-extrabold text-text">
                {archivedClasses.length === 0 ? "—" : archivedClasses.filter((c) => (c as any).status === "active").length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/40">
              <span className="text-sm font-bold text-text">Cursos archivados</span>
              <span className="text-sm font-extrabold text-text">{archivedClasses.length}</span>
            </div>
          </div>
        </section>
      )}

      {tab === "year" && (
        <>
          <section className="glass-card-smooth rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Calendar size={18} /> Año lectivo</h2>
                <p className="text-sm text-muted font-semibold">
                  Creá un año nuevo, activalo para empezar a usarlo, y cerrá el año viejo cuando termine el ciclo lectivo.
                </p>
              </div>
              {user?.role === "superadmin" && activeYear && !activeYear.closedAt && (
                <Button onClick={() => setWizardYear(activeYear)} className="text-sm">
                  <AlertTriangle size={16} /> Cerrar año actual
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {years.length === 0 && (
                <p className="text-sm text-muted font-semibold">Todavía no hay años lectivos.</p>
              )}
              {years.map((y) => (
                <div key={y.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 flex-wrap">
                  <span className="font-display font-extrabold text-text text-lg min-w-[3.5rem]">{y.label}</span>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full ${
                      y.closedAt
                        ? "bg-muted/30 text-muted"
                        : y.isActive
                        ? "bg-mint/30 text-mint"
                        : "bg-white/60 text-muted"
                    }`}
                  >
                    {y.closedAt ? "Cerrado" : y.isActive ? "Activo" : "Inactivo"}
                  </span>
                  <span className="text-xs text-muted ml-auto">{relTime(y.createdAt)}</span>
                  {!y.closedAt && !y.isActive && user?.role === "superadmin" && (
                    <Button variant="secondary" className="text-sm" onClick={() => activateYear(y.id)}>Activar</Button>
                  )}
                </div>
              ))}
            </div>

            {user?.role === "superadmin" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-3 border-t border-white/40">
                <label className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-bold text-text">Crear año lectivo</span>
                  <input
                    className="px-4 py-2.5 rounded-xl bg-white/70 border border-white/60 text-text font-semibold outline-none focus:border-accent-teal focus:ring-2 focus:ring-accent-teal/20"
                    placeholder="2027"
                    value={newYearLabel}
                    onChange={(e) => setNewYearLabel(e.target.value)}
                  />
                </label>
                <Button onClick={createYear} disabled={creatingYear || !newYearLabel.trim()}>
                  Crear año
                </Button>
              </div>
            )}
          </section>

          <section className="glass-card-smooth rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Archive size={18} /> Cursos archivados</h2>
                <p className="text-sm text-muted font-semibold">Cursos cerrados al final del año. Conservan todo el progreso y se pueden reactivar.</p>
              </div>
            </div>
            {archivedClasses.length === 0 ? (
              <p className="text-sm text-muted font-semibold">No hay cursos archivados.</p>
            ) : (
              <DataTable
                columns={[
                  { key: "name", header: "Nombre", render: (c: ApiClass) => <span className="font-semibold">{c.name}</span> },
                  { key: "grade", header: "Grado" },
                  { key: "students", header: "Alumnos", render: (c: ApiClass) => c.studentCount },
                  { key: "teachers", header: "Docentes", render: (c: ApiClass) => c.teacherCount },
                  { key: "reactivate", header: "", render: (c: ApiClass) => (
                    <button
                      type="button"
                      onClick={() => reactivateClass(c.id)}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-mint hover:text-white hover:bg-mint px-3 py-1.5 rounded-lg cursor-pointer border-0 transition"
                    >
                      Reactivar
                    </button>
                  ) },
                ]}
                rows={archivedClasses}
                getKey={(c) => c.id}
                empty="Sin cursos archivados."
              />
            )}
          </section>
        </>
      )}

      {tab === "audit" && (
        <section className="glass-card-smooth rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display font-extrabold text-lg text-text flex items-center gap-2"><Shield size={18} /> Auditoría</h2>
              <p className="text-sm text-muted font-semibold">
                Cada acción privilegiada (crear, borrar, invitar, cerrar año) queda registrada. Exportable a CSV.
              </p>
            </div>
            <Button variant="secondary" className="text-sm" onClick={exportAuditCsv} disabled={audit.length === 0}>
              <Download size={15} /> Exportar CSV
            </Button>
          </div>
          <label className="glass-surface grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl h-11 px-3 max-w-md">
            <Search size={16} className="text-muted" />
            <input
              type="search"
              className="bg-transparent outline-none text-text placeholder:text-muted/60 w-full text-sm"
              placeholder="Buscar por acción, actor, id…"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            />
          </label>
          <DataTable
            columns={[
              { key: "at", header: "Cuándo", render: (e: AuditEntry) => (
                <span className="text-xs text-muted font-semibold whitespace-nowrap">{relTime(e.at)}</span>
              ) },
              { key: "actor", header: "Actor", render: (e: AuditEntry) => e.actorName ?? "—" },
              { key: "action", header: "Acción", render: (e: AuditEntry) => (
                <span className="text-sm font-bold text-text">{ACTION_LABELS[e.action] ?? e.action}</span>
              ) },
              { key: "entity", header: "Entidad", render: (e: AuditEntry) => (
                <span className="text-xs text-muted">{ENTITY_LABELS[e.entityType] ?? e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}</span>
              ) },
              { key: "meta", header: "Detalle", render: (e: AuditEntry) => (
                <code className="text-[10px] text-muted break-all">{e.meta ?? ""}</code>
              ) },
            ]}
            rows={auditRows}
            getKey={(e) => String(e.id)}
            empty={auditFilter ? "Sin resultados para la búsqueda." : "Sin actividad registrada todavía."}
          />
        </section>
      )}

      {tab === "danger" && (
        <section className="glass-card-smooth rounded-2xl p-6 flex flex-col gap-3 max-w-2xl border-2 border-rose/30">
          <h2 className="font-display font-extrabold text-lg text-rose flex items-center gap-2"><AlertTriangle size={18} /> Zona peligrosa</h2>
          <p className="text-sm text-muted font-semibold">
            Acciones irreversibles. Solo el superadmin puede realizarlas.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-rose/10 border border-rose/30">
              <div>
                <strong className="text-sm text-text">Eliminar la sede completa</strong>
                <p className="text-xs text-muted">Borra todos los cursos, usuarios y progreso. No se puede deshacer.</p>
              </div>
              <Button variant="secondary" className="text-sm" disabled title="Disponible solo desde el panel del superadmin (próximamente)">
                Eliminar sede
              </Button>
            </div>
          </div>
        </section>
      )}

      {wizardYear && (
        <CloseYearWizard
          year={wizardYear}
          onClose={() => setWizardYear(null)}
          onDone={async () => {
            setWizardYear(null);
            await reload();
            flash("Año lectivo cerrado y cursos archivados.");
          }}
        />
      )}
      <Toast message={msg} />
    </SedeShell>
  );
}
