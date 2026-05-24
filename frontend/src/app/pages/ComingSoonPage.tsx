import { useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { AppShell } from "@/app/layout/AppShell";
import { useAuth } from "@/features/auth/context/AuthContext";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

interface Props {
  title: string;
}

export function ComingSoonPage({ title }: Props) {
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate(ROUTES.login);
  };

  return (
    <AppShell onLogout={() => void handleLogout()}>
      <Box sx={{ p: 4, maxWidth: 560, mx: "auto", mt: 6 }}>
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {en.app.pages.comingSoon}
        </Typography>
      </Box>
    </AppShell>
  );
}
