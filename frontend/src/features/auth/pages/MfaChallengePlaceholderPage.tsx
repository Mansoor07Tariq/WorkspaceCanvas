import { useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { CenteredPageLayout } from "@/components/layout/CenteredPageLayout";
import { AuthCard } from "../components/AuthCard";

interface LocationState {
  challengeId?: string;
  email?: string;
}

export function MfaChallengePlaceholderPage() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  return (
    <CenteredPageLayout>
      <AuthCard>
        <Box sx={{ textAlign: "center", py: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {en.auth.login.mfaRequiredTitle}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: state?.challengeId ? 2 : 0 }}
          >
            {en.auth.login.mfaRequiredMessage}
          </Typography>
          {state?.challengeId && (
            <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
              Challenge: {state.challengeId}
            </Typography>
          )}
        </Box>
      </AuthCard>
    </CenteredPageLayout>
  );
}
