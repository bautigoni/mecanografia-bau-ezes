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
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Superadmin has full access to every protected route — EXCEPT routes
  // explicitly marked exclusive (the student-only game experience).
  if (user.role === "superadmin" && !exclusive) {
    return <Outlet />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
