import type { ReactNode } from "react";
import { Home, BookOpen, GraduationCap, Users, LineChart, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DashboardShell } from "../dashboard/DashboardShell";
import { useAuth } from "../../hooks/useAuth";

/* Shared Admin-de-Sede chrome: one sidebar, route-based, used by every
   admin-sede screen so navigation is consistent (F1 of the redesign). */

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
  const name = user?.name ?? "Admin de sede";
  const email = user?.email;
  const initial = name.slice(0, 1).toUpperCase();

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
    >
      {children}
    </DashboardShell>
  );
}
