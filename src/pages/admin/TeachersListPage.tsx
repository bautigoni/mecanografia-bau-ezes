import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Send, X, KeyRound, Trash2, Eye } from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";
import { DataTable } from "../../components/admin/DataTable";
import { ImpersonateModal } from "../../components/admin/ImpersonateModal";
import { useAuth } from "../../hooks/useAuth";
import { api, type ApiUser } from "../../utils/api";

export function relTime(iso?: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`;
  return `Hace ${Math.floor(days / 365)} años`;
}

export function TeachersListPage() {
  const navigate = useNavigate();
  const { user, viewAs } = useAuth();
  const siteId = user?.role === "superadmin" && viewAs?.sedeId ? viewAs.sedeId : user?.siteId;

  const [teachers, setTeachers] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "invite" | "create">(null);
  const [draft, setDraft] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState<{ id: string; password: string } | null>(null);
  const [impTarget, setImpTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try { setTeachers(await api.listUsers({ role: "profesor", sedeId: siteId ?? undefined })); }
    catch { setMsg("No se pudieron cargar los docentes."); }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => t.fullName.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [teachers, search]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.email.trim()) return;
    setBusy(true);
    try {
      if (modal === "invite") {
        await api.createInvitation({ email: draft.email.trim(), name: draft.name.trim(), role: "profesor", sedeId: siteId ?? undefined });
        setMsg("Invitación enviada.");
      } else {
        const res = await api.createUser({ fullName: draft.name.trim(), email: draft.email.trim(), role: "profesor", sedeId: siteId });
        if (res.temporaryPassword) setPass({ id: res.user.id, password: res.temporaryPassword });
        setMsg("Docente creado.");
      }
      setModal(null);
      setDraft({ name: "", email: "" });
      await load();
    } catch { setMsg("No se pudo completar la acción."); } finally { setBusy(false); }
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
      active="docentes"
      search={{ value: search, onChange: setSearch, placeholder: "Buscar docente…" }}
      hero={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-black text-2xl text-text">Docentes</h1>
            <p className="text-muted font-semibold text-sm">{teachers.length} docente(s).</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setModal("invite"); setDraft({ name: "", email: "" }); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-text glass-surface cursor-pointer"><Send size={17} /> Invitar</button>
            <button type="button" onClick={() => { setModal("create"); setDraft({ name: "", email: "" }); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn cursor-pointer"><Plus size={18} /> Crear docente</button>
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
        getKey={(t) => t.id}
        onRowClick={(t) => navigate(`/admin-sede/docentes/${t.id}`)}
        columns={[
          { key: "fullName", header: "Nombre", render: (t) => <strong className="font-bold text-text">{t.fullName}</strong> },
          { key: "email", header: "Email", render: (t) => <span className="text-muted">{t.email}</span> },
          { key: "username", header: "Usuario", render: (t) => <span className="text-muted">{t.username ?? "—"}</span> },
          { key: "lastLoginAt", header: "Última conexión", render: (t) => relTime(t.lastLoginAt) },
        ]}
        actions={(t) => (
          <div className="flex items-center gap-1.5 justify-end">
            <button type="button" onClick={() => setImpTarget({ id: t.id, name: t.fullName })} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-amber-100 text-amber-700 cursor-pointer" aria-label="Ver en modo lectura" title="Ver en modo lectura"><Eye size={15} /></button>
            <button type="button" onClick={() => resetPass(t.id)} disabled={busy} className="glass-surface rounded-lg px-2.5 py-1.5 text-xs font-bold text-text hover:brightness-105 cursor-pointer flex items-center gap-1"><KeyRound size={13} /> Clave</button>
            <button type="button" onClick={() => remove(t.id)} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-rose/20 text-rose cursor-pointer" aria-label="Eliminar"><Trash2 size={15} /></button>
          </div>
        )}
        empty="No hay docentes todavía."
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-overlay-fade" role="dialog" aria-modal="true">
          <div className="modal-overlay" onClick={() => setModal(null)} />
          <form onSubmit={submit} className="glass-card-smooth modal-card relative z-10 p-6 w-[min(26rem,92vw)] flex flex-col gap-4 animate-card-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-text">{modal === "invite" ? "Invitar docente" : "Crear docente"}</h2>
              <button type="button" onClick={() => setModal(null)} className="w-8 h-8 grid place-items-center rounded-full bg-white/40 text-text/60 hover:text-text cursor-pointer"><X size={16} /></button>
            </div>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Nombre
              <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-text">Email
              <input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className="h-11 px-4 rounded-xl bg-white/70 border border-white/60 outline-none font-semibold" />
            </label>
            <p className="text-xs text-muted">{modal === "invite" ? "Le llega un email para activar su cuenta (o entra con Google)." : "Se crea con una contraseña temporal que deberá cambiar."}</p>
            <button type="submit" disabled={busy || !draft.name.trim() || !draft.email.trim()} className="h-11 rounded-xl font-bold text-white bg-gradient-to-r from-accent to-accent-strong shadow-btn disabled:opacity-50 cursor-pointer">{modal === "invite" ? "Enviar invitación" : "Crear docente"}</button>
          </form>
        </div>
      )}

      {impTarget && <ImpersonateModal target={impTarget} onClose={() => setImpTarget(null)} />}
    </SedeShell>
  );
}
