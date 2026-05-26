import { alpha, keyframes } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

// ─── Shared animations ────────────────────────────────────────────────────────

export const fadeUp = keyframes({
  from: { opacity: 0, transform: "translateY(12px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

export const stepIn = keyframes({
  from: { opacity: 0, transform: "translateY(14px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

// ─── Gradient helpers ─────────────────────────────────────────────────────────

export function brandGradient(theme: Theme): string {
  return `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`;
}

export function brandGradientHover(theme: Theme): string {
  return `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`;
}

export function brandGradientAlpha(
  theme: Theme,
  primaryAlpha: number,
  secondaryAlpha = primaryAlpha
): string {
  return `linear-gradient(135deg, ${alpha(theme.palette.primary.main, primaryAlpha)} 0%, ${alpha(theme.palette.secondary.main, secondaryAlpha)} 100%)`;
}

// ─── ProfileOnboardingProgress ────────────────────────────────────────────────

export const onboardingProgressSx = (theme: Theme) => ({
  width: "100%",
  maxWidth: 560,
  mb: 2,
  "& .MuiStepLabel-label": {
    fontSize: "0.65rem",
    mt: 0.5,
    transition: "color 0.3s ease, font-weight 0.3s ease",
  },
  "& .MuiStepLabel-label.Mui-active": {
    color: theme.palette.primary.main,
    fontWeight: 700,
  },
  "& .MuiStepLabel-label.Mui-completed": {
    color: theme.palette.text.secondary,
    fontWeight: 400,
  },
  "& .MuiStepIcon-root": {
    width: 22,
    height: 22,
    transition: "color 0.3s ease",
  },
  "& .MuiStepIcon-root.Mui-active": {
    color: theme.palette.primary.main,
    filter: `drop-shadow(0 0 4px ${theme.palette.primary.main}55)`,
  },
  "& .MuiStepIcon-root.Mui-completed": {
    color: theme.palette.primary.main,
  },
  "& .MuiStepConnector-line": {
    borderColor: theme.palette.divider,
    transition: "border-color 0.5s ease",
  },
  "& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line": {
    borderColor: theme.palette.primary.main,
  },
  "& .MuiStepIcon-text": {
    fontSize: "0.55rem",
  },
});

// ─── ProfileCompletionProgressBar ────────────────────────────────────────────

export const completionBarTrackSx: SxProps<Theme> = {
  height: 6,
  borderRadius: 3,
  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
  "& .MuiLinearProgress-bar": {
    borderRadius: 3,
    background: (theme) =>
      `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
  },
};

export const completionPercentSx: SxProps<Theme> = {
  fontWeight: 700,
  color: "primary.main",
  transition: "all 0.5s ease",
};

// ─── ProfileOnboardingCarousel ─────────────────────────────────────────────

export const carouselOuterSx: SxProps<Theme> = {
  position: "relative",
  minHeight: "calc(100vh - 64px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  px: { xs: 2, sm: 3 },
  pt: { xs: 3, sm: 4 },
  pb: 4,
};

export const carouselContentSx: SxProps<Theme> = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 740,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flexGrow: 1,
};

export const carouselPaperSx: SxProps<Theme> = {
  width: "100%",
  minHeight: { xs: 440, sm: 520 },
  display: "flex",
  flexDirection: "column",
  p: { xs: 3, sm: 4, md: 5 },
  background: "rgba(255, 255, 255, 0.88)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  borderRadius: 4,
  border: "1px solid",
  boxShadow:
    "0 4px 6px rgba(0,0,0,0.04), 0 16px 48px rgba(37,99,235,0.08), 0 2px 4px rgba(0,0,0,0.04)",
};

export const carouselNavRowSx: SxProps<Theme> = {
  justifyContent: "space-between",
  pt: 1,
};

export const carouselSkipButtonSx: SxProps<Theme> = {
  color: "text.secondary",
};

export const carouselNextButtonSx: SxProps<Theme> = {
  minWidth: 90,
};
