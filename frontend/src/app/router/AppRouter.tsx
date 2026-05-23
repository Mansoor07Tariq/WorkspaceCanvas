import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignupPage, LoginPage, MfaChallengePage } from "@/features/auth";
import { AppPlaceholderPage } from "@/app/pages/AppPlaceholderPage";
import { ROUTES } from "@/routes/paths";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path={ROUTES.mfaChallenge} element={<MfaChallengePage />} />
        <Route path={ROUTES.app} element={<AppPlaceholderPage />} />
        <Route path="/" element={<Navigate to={ROUTES.login} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
