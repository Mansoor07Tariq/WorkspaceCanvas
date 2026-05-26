import { Box, LinearProgress, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { getProfileCompletionPercent } from "../../utils/onboardingProgress";
import { completionBarTrackSx, completionPercentSx } from "../../styles/profile.styles";
import type { OnboardingStep } from "../../types/profile.types";

interface Props {
  step: OnboardingStep;
}

export function ProfileCompletionProgressBar({ step }: Props) {
  const percent = getProfileCompletionPercent(step);
  const label = en.app.profile.carousel.profileCompletion;

  return (
    <Box sx={{ width: "100%" }} aria-label={`${label}: ${percent}%`}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={completionPercentSx}>
          {percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={completionBarTrackSx}
      />
    </Box>
  );
}
