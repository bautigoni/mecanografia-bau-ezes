import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../types";
import { useAuth } from "../hooks/useAuth";
import { routeForRole } from "../utils/storage";

export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Superadmin has full access to every protected route.
  if (user.role === "superadmin") {
    return <Outlet />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={routeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
