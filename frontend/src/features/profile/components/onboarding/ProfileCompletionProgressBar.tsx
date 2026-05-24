import { Box, LinearProgress, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { getProfileCompletionPercent } from "../../utils/onboardingProgress";

interface Props {
  stepIndex: number;
}

export function ProfileCompletionProgressBar({ stepIndex }: Props) {
  const percent = getProfileCompletionPercent(stepIndex);
  const label = en.app.profile.carousel.profileCompletion;

  return (
    <Box sx={{ width: "100%" }} aria-label={`${label}: ${percent}%`}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "primary.main", transition: "all 0.5s ease" }}
        >
          {percent}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: "rgba(37,99,235,0.1)",
          "& .MuiLinearProgress-bar": {
            borderRadius: 3,
            background: "linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)",
            transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
          },
        }}
      />
    </Box>
  );
}
