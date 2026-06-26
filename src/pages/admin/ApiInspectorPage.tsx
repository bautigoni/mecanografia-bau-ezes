import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Globe,
  RefreshCw,
  ScrollText,
  Server,
  Settings2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api, type ApiInspectorReport } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import { routeForRole } from "../../utils/storage";

/* =====================================================================
   Inspector de API — /admin/api (F7).
   Solo superadmin / admin-general / admin-sede (la ruta está protegida y
   el endpoint vuelve a verificar el rol server-side). Muestra:
     - estado del backend (API + DB con latencia)
     - variables de entorno en uso (VITE_* marcadas como públicas,
       secretos siempre enmascarados por el servidor)
     - endpoints vivos con método + respuesta de ejemplo
     - errores recientes y auditoría reciente
     - flags de configuración
===================================================================== */

const METHOD_TONE: Record<string, string> = {
  GET: "bg-accent-sky/15 text-accent-sky",
  POST: "bg-mint/20 text-mint",
  PATCH: "bg-amber-200/50 text-amber-700",
  PUT: "bg-amber-200/50 text-amber-700",
  DELETE: "bg-rose/15 text-rose",
};

function SectionCard({ icon: Icon, title, children }: { icon: typeof Server; title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card-smooth rounded-2xl p-5 flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-text">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent/15 text-accent-strong">
          <Icon size={18} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
        ok ? "bg-mint/20 text-mint" : "bg-rose/15 text-rose"
      }`}
    >
      {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {label}
    </span>
  );
}

/* Variables VITE_* del bundle del navegador — son públicas por diseño
   (Vite las inserta en el JS en build time). */
function clientEnv() {
  return [
    {
      name: "VITE_GOOGLE_CLIENT_ID",
      set: !!(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim(),
      value: (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim() || null,
      note: "Client ID público de Google Identity Services.",
    },
    {
      name: "VITE_GOOGLE_ALLOWED_DOMAINS",
      set: !!(import.meta.env.VITE_GOOGLE_ALLOWED_DOMAINS ?? "").trim(),
      value: (import.meta.env.VITE_GOOGLE_ALLOWED_DOMAINS ?? "").trim() || null,
      note: "Allowlist de dominios institucionales para Google.",
    },
    {
      name: "VITE_API_URL",
      set: !!(import.meta.env.VITE_API_URL ?? "").trim(),
      value: (import.meta.env.VITE_API_URL ?? "").trim() || "/api (default)",
      note: "Base de la API. Sin valor usa /api detrás de Caddy.",
    },
  ];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} d ${h} h ${m} min`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function ApiInspectorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<ApiInspectorReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openRoute, setOpenRoute] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await api.inspector());
    } catch (e) {
      setReport(null);
      setError(
        e instanceof Error && e.message !== "Error desconocido."
          ? e.message
          : "No pudimos consultar la API. ¿El backend está en línea?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const browserVars = useMemo(clientEnv, []);

  return (
    <main className="min-h-dvh animate-page-fade" style={{ background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 60%, #f3f9ff 100%)" }}>
      <div className="mx-auto w-[min(72rem,94vw)] py-8 flex flex-col gap-5">
        {/* ── Encabezado ── */}
        <header className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl glass-surface text-sm font-bold text-muted hover:text-text transition cursor-pointer"
            onClick={() => navigate(routeForRole(user?.role ?? "superadmin"))}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <h1 className="font-display text-2xl font-bold text-text flex items-center gap-2">
            <ShieldCheck size={24} className="text-accent-strong" /> Inspector de API
          </h1>
          <span className="text-muted text-sm">Solo administración — los secretos siempre se muestran enmascarados.</span>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-xl font-extrabold text-white cursor-pointer bg-gradient-to-br from-accent-sky to-accent-strong shadow-btn transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => void load()}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </header>

        {error ? (
          <div className="glass-card-smooth rounded-2xl p-5 flex items-center gap-3 text-rose font-bold">
            <AlertTriangle size={20} /> {error}
          </div>
        ) : null}

        {/* ── Estado ── */}
        <div className="grid gap-5 md:grid-cols-2">
          <SectionCard icon={Server} title="Estado del backend">
            {report ? (
              <ul className="flex flex-col gap-2 text-sm text-text">
                <li className="flex items-center justify-between gap-3">
                  <span className="font-bold">API ({report.service.name} v{report.service.version})</span>
                  <StatusPill ok label="En línea" />
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="font-bold">Base de datos (Postgres)</span>
                  <StatusPill
                    ok={report.db.ok}
                    label={report.db.ok ? `Conectada · ${report.db.latencyMs} ms` : report.db.error ?? "Sin conexión"}
                  />
                </li>
                <li className="flex items-center justify-between gap-3 text-muted">
                  <span>Node {report.service.node} · entorno {report.service.env}</span>
                  <span>Activo hace {formatUptime(report.service.uptimeSeconds)}</span>
                </li>
              </ul>
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-text">API</span>
                <StatusPill ok={false} label={loading ? "Consultando…" : "Sin respuesta"} />
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Settings2} title="Configuración y flags">
            {report ? (
              <ul className="flex flex-col gap-1.5 text-sm text-text">
                <li className="flex justify-between gap-3"><span className="text-muted">Login con Google</span><strong>{report.config.googleLoginEnabled ? "Habilitado" : "Deshabilitado"}</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Emails de invitación (Resend)</span><strong>{report.config.inviteEmailsEnabled ? "Habilitados" : "Solo link compartible"}</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">CORS</span><strong className="truncate">{report.config.corsOrigin}</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Access token</span><strong>{report.config.accessTokenTtlMinutes} min</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Refresh token</span><strong>{report.config.refreshTokenTtlDays} días</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Invitaciones</span><strong>{report.config.invitationTtlDays} días</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Límite de body</span><strong>{Math.round(report.config.bodyLimitBytes / 1024)} KB</strong></li>
                <li className="flex justify-between gap-3"><span className="text-muted">Costo bcrypt</span><strong>{report.config.bcryptCost}</strong></li>
              </ul>
            ) : (
              <p className="text-muted text-sm">Sin datos del servidor.</p>
            )}
          </SectionCard>
        </div>

        {/* ── Variables de entorno ── */}
        <SectionCard icon={Globe} title="Variables de entorno en uso">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Variable</th>
                  <th className="py-2 pr-3">Ámbito</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2">Nota</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {(report?.env ?? []).map((v) => (
                  <tr key={`s-${v.name}`} className="border-t border-white/50">
                    <td className="py-2 pr-3 font-mono font-bold">{v.name}</td>
                    <td className="py-2 pr-3"><span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent-strong text-xs font-extrabold">servidor</span></td>
                    <td className="py-2 pr-3">{v.set ? "Definida" : <span className="text-rose font-bold">Sin definir</span>}</td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">{v.value ?? "—"}</td>
                    <td className="py-2 text-muted text-xs">{v.note}</td>
                  </tr>
                ))}
                {browserVars.map((v) => (
                  <tr key={`c-${v.name}`} className="border-t border-white/50">
                    <td className="py-2 pr-3 font-mono font-bold">{v.name}</td>
                    <td className="py-2 pr-3"><span className="px-2 py-0.5 rounded-full bg-amber-200/50 text-amber-700 text-xs font-extrabold">cliente · PÚBLICA</span></td>
                    <td className="py-2 pr-3">{v.set ? "Definida" : <span className="text-rose font-bold">Sin definir</span>}</td>
                    <td className="py-2 pr-3 font-mono text-xs break-all">{v.value ?? "—"}</td>
                    <td className="py-2 text-muted text-xs">{v.note} Va inserta en el bundle: nunca poner secretos acá.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ── Endpoints ── */}
        <SectionCard icon={Activity} title={`Endpoints de la API${report ? ` (${report.routes.length})` : ""}`}>
          {report ? (
            <ul className="flex flex-col">
              {report.routes.map((r) => {
                const key = `${r.method} ${r.url}`;
                const open = openRoute === key;
                return (
                  <li key={key} className="border-t border-white/50 first:border-t-0">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 py-2 text-left cursor-pointer hover:bg-white/40 rounded-lg px-2 transition"
                      onClick={() => setOpenRoute(open ? null : key)}
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown size={15} className="text-muted shrink-0" /> : <ChevronRight size={15} className="text-muted shrink-0" />}
                      <span className={`px-2 py-0.5 rounded-md text-xs font-black w-16 text-center shrink-0 ${METHOD_TONE[r.method] ?? "bg-white/60 text-muted"}`}>
                        {r.method}
                      </span>
                      <code className="text-sm font-bold text-text break-all">{r.url}</code>
                    </button>
                    {open ? (
                      <pre className="mx-2 mb-3 p-3 rounded-xl bg-[#17355f] text-[#cfeeff] text-xs overflow-x-auto">
                        {r.sample
                          ? `// Respuesta de ejemplo\n${JSON.stringify(r.sample, null, 2)}`
                          : "// Sin respuesta de ejemplo documentada para este endpoint."}
                      </pre>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted text-sm">Sin datos del servidor.</p>
          )}
        </SectionCard>

        {/* ── Errores + auditoría ── */}
        <div className="grid gap-5 md:grid-cols-2">
          <SectionCard icon={AlertTriangle} title="Errores recientes">
            {report?.recentErrors.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {report.recentErrors.map((e, i) => (
                  <li key={i} className="glass-surface rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-rose/15 text-rose text-xs font-black">{e.status}</span>
                      <code className="text-xs font-bold text-text">{e.method} {e.url}</code>
                      <span className="ml-auto text-muted text-xs">{new Date(e.at).toLocaleString("es-AR")}</span>
                    </div>
                    <span className="text-muted text-xs">{e.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{report ? "Sin errores registrados desde el último reinicio. ✨" : "Sin datos del servidor."}</p>
            )}
          </SectionCard>

          <SectionCard icon={ScrollText} title="Auditoría reciente">
            {report?.recentAudit.length ? (
              <ul className="flex flex-col gap-1.5 text-sm text-text">
                {report.recentAudit.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 border-t border-white/50 first:border-t-0 py-1.5">
                    <Database size={14} className="text-accent-strong shrink-0" />
                    <span className="font-bold">{a.action}</span>
                    <span className="text-muted text-xs">{a.entityType}</span>
                    <span className="ml-auto text-muted text-xs whitespace-nowrap">
                      {a.actorName ?? "—"} · {new Date(a.at).toLocaleString("es-AR")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{report ? "Todavía no hay acciones auditadas." : "Sin datos del servidor."}</p>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
