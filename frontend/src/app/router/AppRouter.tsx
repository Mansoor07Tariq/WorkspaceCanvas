import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignupPage } from "@/features/auth";
import { ROUTES } from "@/routes/paths";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path="*" element={<Navigate to={ROUTES.signup} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
