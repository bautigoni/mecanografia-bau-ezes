import { useEffect, useMemo, useState } from "react";
import { X, AlertTriangle, BookOpen, GraduationCap, ArrowRight, Check } from "lucide-react";
import { api, type AcademicYear } from "../../utils/api";

/* F6 — close-year wizard. Two-step flow:
 *   1. Preview impact (how many courses will archive, how many students
 *      will be promoted per target grade).
 *   2. Promotion matrix confirmation (the defaults are sensible but the
 *      admin can override per source grade → target grade | "egresado").
 *   3. Final confirmation → POST /api/academic-years/:id/close.
 * On success the parent reloads.
 *
 * RBAC: only superadmin / admin-general may close. The button in
 * ConfigPage already gates by role, so we don't re-check here. */

const GRADES = ["inicial", "1ep", "2ep", "3ep", "4ep", "5ep", "6ep", "sec", "libre"] as const;
const DEFAULT_PROMOTION: Record<string, string> = {
  inicial: "1ep", "1ep": "2ep", "2ep": "3ep", "3ep": "4ep", "4ep": "5ep",
  "5ep": "6ep", "6ep": "sec", sec: "egresado", libre: "libre",
};

const TARGET_OPTIONS = [...GRADES, "egresado"] as const;

interface PreviewResponse {
  year: { id: string; label: string; courseCount: number; studentCount: number };
  target: { id: string; label: string } | null;
  byGrade: Record<string, number>;
}

interface Props {
  year: AcademicYear;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

async function loadPreview(yearId: string): Promise<PreviewResponse | null> {
  try { return await api.closePreview(yearId); } catch { return null; }
}

export function CloseYearWizard({ year, onClose, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string>>({ ...DEFAULT_PROMOTION });
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { void (async () => {
    const p = await loadPreview(year.id);
    setPreview(p);
    if (p?.target) setTargetYearId(p.target.id);
  })(); }, [year.id]);

  const yearLabel = preview?.year?.label ?? year.label;
  const hasTarget = !!targetYearId;

  async function confirm() {
    setBusy(true); setErr("");
    try {
      await api.closeAcademicYear(year.id, {
        targetYearId: targetYearId || undefined,
        promotion: matrix,
      });
      await onDone();
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo cerrar el año.");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="close-year-title">
      <div className="modal-overlay animate-overlay-fade" onClick={onClose} />
      <div className="glass-card-smooth modal-card relative max-h-[88vh] overflow-y-auto p-8 w-[min(36rem,94vw)] flex flex-col gap-5 animate-menu-reveal">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/30 border-0 cursor-pointer flex items-center justify-center text-text/60 hover:text-text hover:bg-white/50 transition-colors"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <span className="grid place-items-center w-12 h-12 rounded-full bg-rose/15 text-rose" aria-hidden="true">
          <AlertTriangle size={24} />
        </span>
        <h2 id="close-year-title" className="font-display text-xl font-bold text-text">Cerrar año lectivo {yearLabel}</h2>
        <p className="text-muted font-semibold text-sm">
          Esta acción archiva todos los cursos del año, conserva el progreso histórico y promueve a los alumnos al año siguiente.
        </p>

        {/* Stepper */}
        <ol className="flex items-center gap-2 text-xs font-bold text-muted">
          {["Vista previa", "Promoción", "Confirmar"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex items-center gap-1.5">
                <span className={`grid place-items-center w-5 h-5 rounded-full text-[10px] ${active ? "bg-accent text-white" : done ? "bg-mint text-white" : "bg-white/50 text-muted"}`}>
                  {done ? <Check size={12} /> : n}
                </span>
                <span className={active ? "text-text" : ""}>{label}</span>
                {i < 2 && <ArrowRight size={12} className="mx-1 text-muted/60" />}
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-surface rounded-xl p-4 flex flex-col items-center gap-1">
                <BookOpen size={20} className="text-accent-strong" />
                <strong className="text-2xl text-text">{preview?.year?.courseCount ?? "—"}</strong>
                <span className="text-xs text-muted font-bold uppercase">Cursos a archivar</span>
              </div>
              <div className="glass-surface rounded-xl p-4 flex flex-col items-center gap-1">
                <GraduationCap size={20} className="text-accent-teal" />
                <strong className="text-2xl text-text">
                  {preview?.target?.label ?? "(sin año siguiente)"}
                </strong>
                <span className="text-xs text-muted font-bold uppercase">Año destino</span>
              </div>
            </div>
            {preview && Object.keys(preview.byGrade ?? {}).length > 0 && (
              <div className="glass-surface rounded-xl p-3">
                <h4 className="text-xs font-extrabold uppercase text-muted mb-2">Alumnos por grado actual</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.byGrade).map(([g, n]) => (
                    <span key={g} className="text-xs font-bold px-2 py-1 rounded-full bg-white/60 text-text">
                      {g}: {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-sm text-muted font-semibold">
              Si no existe el año siguiente, primero creá uno en la pestaña <b>Año lectivo</b>.
              El cierre siempre es reversible: los cursos pasan a "archivado" y conservan todo su progreso.
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-white/40">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold bg-white/50 text-text cursor-pointer">Cancelar</button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-accent to-accent-strong text-white cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted font-semibold">
              Configurá a qué grado se promueve cada alumno según su curso actual. "Egresado" los marca como recibido sin curso.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GRADES.map((src) => (
                <label key={src} className="flex items-center gap-2 glass-surface rounded-xl px-3 py-2">
                  <span className="text-xs font-extrabold uppercase text-muted w-16 shrink-0">{src}</span>
                  <ArrowRight size={14} className="text-muted shrink-0" />
                  <select
                    className="flex-1 bg-transparent text-text font-semibold outline-none cursor-pointer"
                    value={matrix[src] ?? DEFAULT_PROMOTION[src] ?? "libre"}
                    onChange={(e) => setMatrix((m) => ({ ...m, [src]: e.target.value }))}
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-white/40">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl font-bold bg-white/50 text-text cursor-pointer">Atrás</button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-accent to-accent-strong text-white cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="glass-surface rounded-xl p-4 text-sm text-text font-semibold">
              Al confirmar:
              <ul className="list-disc pl-5 mt-2 text-muted font-semibold space-y-1">
                <li>Todos los cursos del año {yearLabel} pasan a <b>archivado</b>.</li>
                {hasTarget ? (
                  <li>Los alumnos se promueven al año <b>{preview?.target?.label}</b> según la matriz.</li>
                ) : (
                  <li>No hay año siguiente configurado — los alumnos se marcan como <b>egresados</b>.</li>
                )}
                <li>Se conserva todo el progreso, intentos y logros.</li>
                <li>La acción queda registrada en la <b>Auditoría</b>.</li>
              </ul>
            </div>
            {err && <p className="text-sm text-rose font-bold">{err}</p>}
            <div className="flex gap-3 justify-end pt-2 border-t border-white/40">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl font-bold bg-white/50 text-text cursor-pointer">Atrás</button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className="px-4 py-2.5 rounded-xl font-bold bg-rose text-white cursor-pointer disabled:opacity-60"
              >
                {busy ? "Cerrando…" : "Sí, cerrar año"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
