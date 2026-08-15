import { Box, Button, Container, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/context/AuthContext";
import { ProfileOnboardingCarousel } from "@/features/profile";
import { PendingInvitationsPrompt } from "@/features/invitations/components/PendingInvitationsPrompt";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { TodayContent } from "@/features/today/components/TodayContent";
import { ROUTES } from "@/routes/paths";
import { en } from "@/i18n/en";

/**
 * The Today home screen (PR 079) — replaces the dashboard at `/app`. Preserves the prior
 * home gates: incomplete profile → onboarding carousel; no org → the create/join prompt;
 * otherwise surface pending invitations and render the Today content.
 */
export function TodayPage() {
  const { user } = useAuth();
  if (user && !user.is_profile_completed) {
    return <ProfileOnboardingCarousel />;
  }
  return (
    <>
      <PendingInvitationsPrompt />
      <TodayGate />
    </>
  );
}

function TodayGate() {
  const { selectedMembership } = useSelectedOrganization();
  if (!selectedMembership) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            {en.app.dashboard.noOrgTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {en.app.dashboard.noOrgMessage}
          </Typography>
          <Button variant="contained" size="large" component={Link} to={ROUTES.offices}>
            {en.app.dashboard.createOrgAction}
          </Button>
        </Box>
      </Container>
    );
  }
  return <TodayContent />;
}
