import { useNavigate } from "react-router-dom";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { AppShell } from "@/app/layout/AppShell";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ProfileOnboardingCarousel } from "@/features/profile";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

export function AppPlaceholderPage() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate(ROUTES.login);
  };

  return (
    <AppShell onLogout={() => void handleLogout()}>
      {user && !user.is_profile_completed ? (
        <ProfileOnboardingCarousel />
      ) : (
        <Box sx={{ p: 4, maxWidth: 560, mx: "auto", mt: 6 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" gutterBottom>
                {en.app.placeholder.title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {en.app.placeholder.subtitle}
              </Typography>
            </Box>

            {user && (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {en.app.placeholder.email}
                      </Typography>
                      <Typography variant="body2">{user.email}</Typography>
                    </Box>
                    {user.full_name && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {en.app.placeholder.name}
                        </Typography>
                        <Typography variant="body2">{user.full_name}</Typography>
                      </Box>
                    )}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {en.app.placeholder.organizations}
                      </Typography>
                      <Typography variant="body2">{user.memberships.length}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {user && user.memberships.length === 0 && (
              <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    {en.app.placeholder.noOrganizationsTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {en.app.placeholder.noOrganizationsMessage}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Box>
      )}
    </AppShell>
  );
}
