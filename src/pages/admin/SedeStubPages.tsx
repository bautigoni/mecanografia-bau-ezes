import { LineChart, Settings } from "lucide-react";
import { SedeShell } from "../../components/admin/SedeShell";

/* Placeholders for the F1 navigation skeleton. Full builds land in later
   phases (F3 progress dashboard, F6 academic year / config). */

export function ProgresoPage() {
  return (
    <SedeShell active="progreso" hero={<h1 className="font-display font-black text-2xl text-text">Progreso</h1>}>
      <div className="glass-card-smooth rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <LineChart size={40} className="text-accent-strong" />
        <h2 className="font-display font-bold text-xl text-text">Vista de progreso — próximamente</h2>
        <p className="text-muted font-semibold max-w-md">
          Acá va el panel ejecutivo: rendimiento por grado / curso / docente, tendencias
          semanales y alumnos en riesgo (heatmap estilo Matific). Se construye en la fase F3/F4.
        </p>
      </div>
    </SedeShell>
  );
}

export function ConfigPage() {
  return (
    <SedeShell active="config" hero={<h1 className="font-display font-black text-2xl text-text">Configuración</h1>}>
      <div className="glass-card-smooth rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <Settings size={40} className="text-accent-strong" />
        <h2 className="font-display font-bold text-xl text-text">Configuración de la sede — próximamente</h2>
        <p className="text-muted font-semibold max-w-md">
          Datos de la sede, logo, año lectivo (archivar/promover), y preferencias.
          Se construye en la fase F6.
        </p>
      </div>
    </SedeShell>
  );
}
