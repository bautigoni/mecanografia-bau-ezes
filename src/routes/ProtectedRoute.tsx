import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";

/**
 * Role-gated route group.
 *
 * `exclusive` = true means ONLY the listed roles may enter — the superadmin
 * bypass is disabled. This is used to keep the student game map exclusively
 * for students, so an admin is always redirected to their own dashboard.
 */
export function ProtectedRoute({ roles, exclusive = false }: { roles: Role[]; exclusive?: boolean }) {
  const { user, viewAs } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // A user who logged in with a temporary password must set a new one before
  // reaching ANY protected surface, regardless of role.
  if (user.mustChangePassword) {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  // Superadmin has full access to every protected route. Exclusive routes
  // (the student-only game map) are normally off-limits, but the god-mode
  // chooser lets a superadmin explicitly enter as "alumno" to play / use
  // the developer level editor.
  if (user.role === "superadmin") {
    if (!exclusive) return <Outlet />;
    if (exclusive && viewAs?.role === "alumno") return <Outlet />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
