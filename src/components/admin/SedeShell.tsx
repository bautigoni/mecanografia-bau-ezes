import type { ReactNode } from "react";
import { useState } from "react";
import { Home, BookOpen, GraduationCap, Users, LineChart, Settings, Calendar } from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { DashboardShell } from "../dashboard/DashboardShell";
import { useAuth } from "../../hooks/useAuth";
import { AcademicYearProvider, useAcademicYear } from "../../hooks/useAcademicYear";

/* Shared Admin-de-Sede chrome: one sidebar, route-based, used by every
   admin-sede screen so navigation is consistent (F1 of the redesign).
   F6 added: the academic-year context + a small year selector in the
   sidebar so every screen can be scoped to a single año lectivo. */

/* Route-level provider for the academic-year context. It MUST wrap the
   admin-sede pages from App.tsx (an <Outlet/> layout): the pages call
   useAcademicYear() in their own bodies, OUTSIDE of <SedeShell/>'s subtree,
   so a provider inside SedeShell can never reach them. (Having it inside
   SedeShell crashed /admin-sede/cursos and /admin-sede/alumnos on mount —
   the hook throws without a provider and React unmounted to a grey page.) */
export function SedeAcademicYearLayout() {
  const { user, viewAs } = useAuth();
  const sedeId = (user?.role === "superadmin" && viewAs?.sedeId ? viewAs.sedeId : user?.siteId) ?? null;
  return (
    <AcademicYearProvider sedeId={sedeId}>
      <Outlet />
    </AcademicYearProvider>
  );
}

const NAV = [
  { id: "inicio", label: "Inicio", icon: Home, path: "/admin-sede" },
  { id: "cursos", label: "Cursos", icon: BookOpen, path: "/admin-sede/cursos" },
  { id: "docentes", label: "Docentes", icon: GraduationCap, path: "/admin-sede/docentes" },
  { id: "alumnos", label: "Alumnos", icon: Users, path: "/admin-sede/alumnos" },
  { id: "progreso", label: "Progreso", icon: LineChart, path: "/admin-sede/progreso" },
  { id: "config", label: "Configuración", icon: Settings, path: "/admin-sede/config" },
] as const;

export type SedeNavId = (typeof NAV)[number]["id"];

export function SedeShell({
  active,
  hero,
  search,
  children,
}: {
  active: SedeNavId;
  hero: ReactNode;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { years, selected, setSelectedId } = useAcademicYear();
  const name = user?.name ?? "Admin de sede";
  const email = user?.email;
  const initial = name.slice(0, 1).toUpperCase();
  const [open, setOpen] = useState(false);

  return (
    <DashboardShell
      accent="green"
      roleLabel="Admin de sede"
      roleSubtitle={email ?? "Panel de sede"}
      roleIcon={GraduationCap}
      account={{ name, email, initial }}
      nav={NAV.map((n) => ({ id: n.id, label: n.label, icon: n.icon }))}
      activeId={active}
      onNavigate={(id) => {
        const item = NAV.find((n) => n.id === id);
        if (item) navigate(item.path);
      }}
      onLogout={() => {
        logout();
        navigate("/login");
      }}
      search={search}
      hero={hero}
      /* Inject the year selector into the sidebar's role chip slot. */
      sidebarTop={
        <div className="glass-surface flex items-center gap-2.5 p-3 rounded-xl">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent/15 text-accent-strong">
            <GraduationCap size={20} />
          </span>
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <strong className="text-text text-sm font-extrabold">Admin de sede</strong>
            <span className="text-muted text-xs truncate">{email ?? "Panel de sede"}</span>
          </div>
        </div>
      }
      sidebarBelowRole={
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass-surface text-sm font-bold text-text cursor-pointer"
            title="Cambiar año lectivo"
          >
            <Calendar size={16} className="text-accent-strong shrink-0" />
            <span className="flex-1 text-left">
              {selected ? `Año ${selected.label}` : "Año lectivo"}
            </span>
            {selected?.isActive && (
              <span className="text-[10px] font-black uppercase text-mint">Activo</span>
            )}
          </button>
          {open && (
            <ul className="absolute left-0 right-0 mt-1 z-30 glass-card-smooth rounded-xl p-1 shadow-card max-h-60 overflow-y-auto" role="listbox">
              {years.length === 0 && (
                <li className="px-3 py-2 text-xs text-muted">Sin años lectivos.</li>
              )}
              {years.map((y) => (
                <li key={y.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(y.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer text-left ${
                      y.id === selected?.id ? "bg-accent/10 text-accent-strong" : "text-text hover:bg-white/40"
                    }`}
                  >
                    <span className="flex-1">Año {y.label}</span>
                    {y.closedAt && <span className="text-[10px] font-black uppercase text-muted">Cerrado</span>}
                    {!y.closedAt && y.isActive && <span className="text-[10px] font-black uppercase text-mint">Activo</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
