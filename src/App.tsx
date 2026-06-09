import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { EntrarPage } from "./pages/EntrarPage";
import { LoginLayoutEditorPage } from "./pages/LoginLayoutEditorPage";
import { GlassEditorPage } from "./pages/GlassEditorPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { InvitePage } from "./pages/InvitePage";
import { WorldsPage } from "./pages/WorldsPage";
import { IslandDetailPage } from "./pages/IslandDetailPage";
import { TeacherPage } from "./pages/TeacherPage";
import { TeacherClassPage } from "./pages/TeacherClassPage";
import { TeacherStudentPage } from "./pages/TeacherStudentPage";
import { RewardsPage } from "./pages/RewardsPage";
import { AccountPage } from "./pages/AccountPage";
import { MissionsPage } from "./pages/MissionsPage";

/* -------------------------------------------------------------------- */
/* Route-level code splitting.                                            */
/* -------------------------------------------------------------------- */
/* The four heaviest pages are loaded on demand so the initial bundle     */
/* (login + world map + island detail) stays under ~150 kB gzipped.      */
/* `Suspense` shows a soft, on-brand loader instead of a blank flash.    */
const GameplayPage = lazy(() =>
  import("./pages/GameplayPage").then((m) => ({ default: m.GameplayPage })),
);
const AdminGeneralPage = lazy(() =>
  import("./pages/AdminGeneralPage").then((m) => ({ default: m.AdminGeneralPage })),
);
const SiteAdminPage = lazy(() =>
  import("./pages/SiteAdminPage").then((m) => ({ default: m.SiteAdminPage })),
);

function PageFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #cfeeff 0%, #e8f6ff 100%)",
        fontFamily: "var(--font-display)",
        color: "#17355f",
        letterSpacing: "0.04em",
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <span>Cargando…</span>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Forced password change after a temporary-password sign-in. */}
      <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
      {/* Invitation acceptance (opened from the email link). */}
      <Route path="/invite/:token" element={<InvitePage />} />
      {/* Superadmin god-mode chooser — "¿Cómo querés entrar?". */}
      <Route element={<ProtectedRoute roles={["superadmin"]} />}>
        <Route path="/entrar" element={<EntrarPage />} />
        {/* Superadmin-only sandbox to drag the login mascots and read off
            their positions. Does not affect the real login screen. */}
        <Route path="/editor-login" element={<LoginLayoutEditorPage />} />
        {/* Superadmin-only liquid-glass tuner. */}
        <Route path="/editor-glass" element={<GlassEditorPage />} />
      </Route>

      {/* Student game experience — exclusive to students. Admins/teachers
          are redirected to their own dashboards, never the game map. */}
      <Route element={<ProtectedRoute roles={["alumno"]} exclusive />}>
        <Route path="/mundos" element={<WorldsPage />} />
        <Route path="/worlds/:islandId" element={<IslandDetailPage />} />
        <Route
          path="/gameplay/:activityId"
          element={
            <Suspense fallback={<PageFallback />}>
              <GameplayPage />
            </Suspense>
          }
        />
        <Route path="/logros" element={<RewardsPage />} />
        <Route path="/mi-cuenta" element={<AccountPage />} />
        <Route path="/misiones" element={<MissionsPage />} />
      </Route>

      <Route element={<ProtectedRoute roles={["admin-general"]} />}>
        <Route
          path="/admin-general"
          element={
            <Suspense fallback={<PageFallback />}>
              <AdminGeneralPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<ProtectedRoute roles={["admin-sede"]} />}>
        <Route
          path="/admin-sede"
          element={
            <Suspense fallback={<PageFallback />}>
              <SiteAdminPage />
            </Suspense>
          }
        />
      </Route>

      <Route element={<ProtectedRoute roles={["profesor"]} />}>
        <Route path="/profesor" element={<TeacherPage />} />
        <Route path="/profesor/curso/:classId" element={<TeacherClassPage />} />
        <Route path="/profesor/alumno/:studentId" element={<TeacherStudentPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
