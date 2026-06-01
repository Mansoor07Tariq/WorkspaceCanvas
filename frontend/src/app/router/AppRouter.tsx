import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestOnlyRoute } from "@/app/router/GuestOnlyRoute";
import { PageLoading } from "@/components/feedback/PageLoading";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { AppShell } from "@/app/layout/AppShell";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ROUTES } from "@/routes/paths";

// Auth pages — lazy-loaded so none of their imports reach the initial bundle.
const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  }))
);
const SignupPage = lazy(() =>
  import("@/features/auth/pages/SignupPage").then((m) => ({
    default: m.SignupPage,
  }))
);
const VerifyEmailPage = lazy(() =>
  import("@/features/auth/pages/VerifyEmailPage").then((m) => ({
    default: m.VerifyEmailPage,
  }))
);
const MfaChallengePage = lazy(() =>
  import("@/features/auth/pages/MfaChallengePage").then((m) => ({
    default: m.MfaChallengePage,
  }))
);
const MfaSetupPage = lazy(() =>
  import("@/features/auth/pages/MfaSetupPage").then((m) => ({
    default: m.MfaSetupPage,
  }))
);

// App pages — lazy-loaded so MUI-heavy pages are not in the initial bundle.
const DashboardPage = lazy(() =>
  import("@/app/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  }))
);
const AppOfficesPage = lazy(() =>
  import("@/app/pages/AppOfficesPage").then((m) => ({
    default: m.AppOfficesPage,
  }))
);
const OfficeDetailPage = lazy(() =>
  import("@/app/pages/OfficeDetailPage").then((m) => ({
    default: m.OfficeDetailPage,
  }))
);
const FloorLayoutPage = lazy(() =>
  import("@/app/pages/FloorLayoutPage").then((m) => ({
    default: m.FloorLayoutPage,
  }))
);
const DeskBookingPage = lazy(() =>
  import("@/app/pages/DeskBookingPage").then((m) => ({
    default: m.DeskBookingPage,
  }))
);
const MyBookingsPage = lazy(() =>
  import("@/app/pages/MyBookingsPage").then((m) => ({
    default: m.MyBookingsPage,
  }))
);
const NotFoundPage = lazy(() =>
  import("@/app/pages/NotFoundPage").then((m) => ({
    default: m.NotFoundPage,
  }))
);
const PeoplePage = lazy(() =>
  import("@/features/teams/pages/PeoplePage").then((m) => ({
    default: m.PeoplePage,
  }))
);
const AcceptInvitationPage = lazy(() =>
  import("@/features/invitations/pages/AcceptInvitationPage").then((m) => ({
    default: m.AcceptInvitationPage,
  }))
);

/**
 * Shared layout for all authenticated app pages.
 * Renders AppShell (topbar + sidebar) around the matched child route via <Outlet>.
 * Logout is handled here so individual pages don't need it.
 */
function AppLayout() {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate(ROUTES.login);
  }

  return (
    <AppShell onLogout={() => void handleLogout()}>
      <Outlet />
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* ── Guest-only auth pages ────────────────────────────────── */}
            <Route
              path={ROUTES.login}
              element={
                <GuestOnlyRoute>
                  <LoginPage />
                </GuestOnlyRoute>
              }
            />
            <Route
              path={ROUTES.signup}
              element={
                <GuestOnlyRoute>
                  <SignupPage />
                </GuestOnlyRoute>
              }
            />
            <Route
              path={ROUTES.verifyEmail}
              element={
                <GuestOnlyRoute>
                  <VerifyEmailPage />
                </GuestOnlyRoute>
              }
            />
            <Route
              path={ROUTES.mfaChallenge}
              element={
                <GuestOnlyRoute>
                  <MfaChallengePage />
                </GuestOnlyRoute>
              }
            />

            {/* ── Protected app pages — all share AppShell via AppLayout ─ */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path={ROUTES.app} element={<DashboardPage />} />
              <Route path={ROUTES.mfaSetup} element={<MfaSetupPage />} />
              <Route path={ROUTES.offices} element={<AppOfficesPage />} />
              <Route path={ROUTES.officeDetail} element={<OfficeDetailPage />} />
              <Route path={ROUTES.floorLayout} element={<FloorLayoutPage />} />
              <Route path={ROUTES.bookings} element={<DeskBookingPage />} />
              <Route path={ROUTES.myBookings} element={<MyBookingsPage />} />
              <Route path={ROUTES.people} element={<PeoplePage />} />
            </Route>

            {/* ── Public routes ────────────────────────────────────────── */}
            <Route path={ROUTES.inviteAccept} element={<AcceptInvitationPage />} />
            <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
