import { Box, Button, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { WorkspacesOutlined } from "@mui/icons-material";
import { keyframes } from "@mui/system";
import { en } from "@/i18n/en";

const fadeUp = keyframes({
  from: { opacity: 0, transform: "translateY(12px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const pulseGlow = keyframes({
  "0%, 100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0)" },
  "50%": { boxShadow: "0 0 0 12px rgba(37,99,235,0.08)" },
});

interface Props {
  onStart: () => void;
}

export function StepWelcome({ onStart }: Props) {
  const theme = useTheme();
  const c = en.app.profile.carousel;

  return (
    <Stack spacing={4} sx={{ alignItems: "center", textAlign: "center", py: 1 }}>
      {/* Animated brand icon */}
      <Box
        sx={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${pulseGlow} 3s ease-in-out infinite`,
          },
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.35)}`,
          }}
        >
          <WorkspacesOutlined sx={{ fontSize: 44, color: "white" }} />
        </Box>
      </Box>

      {/* Animated text lines — each fades in with staggered delay */}
      <Stack spacing={1.5}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            "@media (prefers-reduced-motion: no-preference)": {
              animation: `${fadeUp} 0.5s ease-out both`,
              animationDelay: "0.05s",
            },
          }}
        >
          {c.stepWelcomeTitle}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            maxWidth: 380,
            lineHeight: 1.7,
            "@media (prefers-reduced-motion: no-preference)": {
              animation: `${fadeUp} 0.5s ease-out both`,
              animationDelay: "0.18s",
            },
          }}
        >
          {c.stepWelcomeSubtitle}
        </Typography>
      </Stack>

      {/* Decorative office-desk visual */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 340,
          p: 2,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.12),
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${fadeUp} 0.5s ease-out both`,
            animationDelay: "0.32s",
          },
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
          {[
            { label: "Desks", emoji: "🪑", color: theme.palette.primary.main },
            { label: "Events", emoji: "📅", color: theme.palette.secondary.main },
            { label: "Teams", emoji: "👥", color: "#059669" },
          ].map(({ label, emoji, color }) => (
            <Box
              key={label}
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "background.paper",
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                border: "1px solid",
                borderColor: alpha(color, 0.15),
              }}
            >
              <Typography sx={{ fontSize: 20, mb: 0.25 }}>{emoji}</Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color, display: "block", lineHeight: 1.2 }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* CTA */}
      <Box
        sx={{
          width: "100%",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${fadeUp} 0.5s ease-out both`,
            animationDelay: "0.44s",
          },
        }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          fullWidth
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            "&:hover": {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
            },
            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
            py: 1.5,
            fontSize: "1rem",
          }}
        >
          {c.stepWelcomeCta}
        </Button>
      </Box>
    </Stack>
  );
}
