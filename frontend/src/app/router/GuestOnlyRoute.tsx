import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

interface Props {
  children: ReactNode;
}

export function GuestOnlyRoute({ children }: Props) {
  const { status } = useAuth();

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
          {en.auth.session.loading}
        </Typography>
      </Box>
    );
  }

  if (status === "authenticated") {
    return <Navigate to={ROUTES.app} replace />;
  }

  return <>{children}</>;
}
