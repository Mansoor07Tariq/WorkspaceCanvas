import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignupPage } from "../../features/auth/pages/SignupPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
