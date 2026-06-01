import { Box, LinearProgress, Typography } from "@mui/material";
import { en } from "@/i18n/en";

interface Props {
  firstName: string;
  isOwnerOrAdmin: boolean;
  hasOrg: boolean;
  orgName: string | null;
  setupProgress: number;
  /** For members: whether bookable desks exist so "book your next day" is valid. */
  isWorkspaceReady?: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return en.app.dashboard.greetingMorning;
  if (hour < 18) return en.app.dashboard.greetingAfternoon;
  return en.app.dashboard.greetingEvening;
}

export function DashboardHero({
  firstName,
  isOwnerOrAdmin,
  hasOrg,
  orgName,
  setupProgress,
  isWorkspaceReady = true,
}: Props) {
  const greeting = getGreeting();
  const displayName = firstName || "there";

  let headline: string;
  if (!hasOrg) {
    headline = en.app.dashboard.heroNoOrg;
  } else if (isOwnerOrAdmin) {
    headline =
      setupProgress === 100
        ? `${en.app.dashboard.heroAdminReady}${orgName ? ` — ${orgName}` : ""}`
        : en.app.dashboard.heroAdminSetup;
  } else {
    headline = isWorkspaceReady ? en.app.dashboard.heroMember : en.app.dashboard.heroMemberSetup;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {greeting}, {displayName}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
        {headline}
      </Typography>
      {isOwnerOrAdmin && hasOrg && setupProgress < 100 && (
        <Box sx={{ mt: 2, maxWidth: 400 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {en.app.dashboard.setupProgressLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {setupProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={setupProgress}
            aria-label={en.app.dashboard.setupProgressLabel}
          />
        </Box>
      )}
    </Box>
  );
}
