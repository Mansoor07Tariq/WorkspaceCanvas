import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { PageLoading } from "@/components/feedback/PageLoading";
import { en } from "@/i18n/en";
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
const AppPlaceholderPage = lazy(() =>
  import("@/app/pages/AppPlaceholderPage").then((m) => ({
    default: m.AppPlaceholderPage,
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
const ComingSoonPage = lazy(() =>
  import("@/app/pages/ComingSoonPage").then((m) => ({
    default: m.ComingSoonPage,
  }))
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.signup} element={<SignupPage />} />
          <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
          <Route path={ROUTES.mfaChallenge} element={<MfaChallengePage />} />
          <Route
            path={ROUTES.mfaSetup}
            element={
              <ProtectedRoute>
                <MfaSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.app}
            element={
              <ProtectedRoute>
                <AppPlaceholderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.offices}
            element={
              <ProtectedRoute>
                <AppOfficesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.officeDetail}
            element={
              <ProtectedRoute>
                <OfficeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.floorLayout}
            element={
              <ProtectedRoute>
                <FloorLayoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.bookings}
            element={
              <ProtectedRoute>
                <ComingSoonPage title={en.app.sidebar.deskBooking} />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.events}
            element={
              <ProtectedRoute>
                <ComingSoonPage title={en.app.sidebar.events} />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.people}
            element={
              <ProtectedRoute>
                <ComingSoonPage title={en.app.sidebar.people} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
          <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
