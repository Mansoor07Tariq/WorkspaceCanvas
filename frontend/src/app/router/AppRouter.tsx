import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  SignupPage,
  LoginPage,
  MfaChallengePage,
  MfaSetupPage,
  VerifyEmailPage,
} from "@/features/auth";
import { AppPlaceholderPage } from "@/app/pages/AppPlaceholderPage";
import { AppOfficesPage } from "@/app/pages/AppOfficesPage";
import { OfficeDetailPage } from "@/app/pages/OfficeDetailPage";
import { ComingSoonPage } from "@/app/pages/ComingSoonPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

export function AppRouter() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
