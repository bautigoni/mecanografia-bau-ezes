import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { WorldsPage } from "./pages/WorldsPage";
import { IslandDetailPage } from "./pages/IslandDetailPage";
import { AdminGeneralPage } from "./pages/AdminGeneralPage";
import { SiteAdminPage } from "./pages/SiteAdminPage";
import { TeacherPage } from "./pages/TeacherPage";
import { GameplayPage } from "./pages/GameplayPage";
import { RewardsPage } from "./pages/RewardsPage";
import { AccountPage } from "./pages/AccountPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Forced password change after a temporary-password sign-in. */}
      <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

      {/* Student game experience — exclusive to students. Admins/teachers
          are redirected to their own dashboards, never the game map. */}
      <Route element={<ProtectedRoute roles={["alumno"]} exclusive />}>
        <Route path="/mundos" element={<WorldsPage />} />
        <Route path="/worlds/:islandId" element={<IslandDetailPage />} />
        <Route path="/gameplay/:activityId" element={<GameplayPage />} />
        <Route path="/logros" element={<RewardsPage />} />
        <Route path="/mi-cuenta" element={<AccountPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={["admin-general"]} />}>
        <Route path="/admin-general" element={<AdminGeneralPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={["admin-sede"]} />}>
        <Route path="/admin-sede" element={<SiteAdminPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={["profesor"]} />}>
        <Route path="/profesor" element={<TeacherPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
