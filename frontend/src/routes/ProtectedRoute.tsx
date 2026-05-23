import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { en } from "@/i18n/en";
import { ROUTES } from "./paths";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          {en.auth.session.protectedRouteLoading}
        </Typography>
      </Box>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
