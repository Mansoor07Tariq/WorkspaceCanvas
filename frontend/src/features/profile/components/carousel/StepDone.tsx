import { Avatar, Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircle, PublicOutlined, WorkspacesOutlined } from "@mui/icons-material";
import { keyframes } from "@mui/system";
import { en } from "@/i18n/en";
import { fadeUp, brandGradient, brandGradientAlpha } from "../../styles/profile.styles";
import { getAvatarInitials } from "../../utils/avatarFallback";

const popIn = keyframes({
  "0%": { opacity: 0, transform: "scale(0.5)" },
  "70%": { transform: "scale(1.08)" },
  "100%": { opacity: 1, transform: "scale(1)" },
});

interface Props {
  fullName: string;
  email: string;
  timezone: string;
  avatarPreview: string | null;
  avatarUrl: string | null;
}

export function StepDone({ fullName, email, timezone, avatarPreview, avatarUrl }: Props) {
  const theme = useTheme();
  const c = en.app.profile.carousel;
  const src = avatarPreview ?? avatarUrl ?? undefined;
  const firstName = fullName.trim().split(/\s+/)[0] || "";

  return (
    <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
      {/* Animated check icon */}
      <Box
        sx={{
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${popIn} 0.5s cubic-bezier(0.34,1.56,0.64,1) both`,
          },
        }}
      >
        <CheckCircle
          sx={{
            fontSize: 64,
            color: "success.main",
            filter: "drop-shadow(0 4px 12px rgba(22,163,74,0.3))",
          }}
        />
      </Box>

      {/* Personalized greeting */}
      <Stack
        spacing={0.5}
        sx={{
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${fadeUp} 0.4s ease-out both`,
            animationDelay: "0.15s",
          },
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {firstName ? `${c.stepDoneGreeting}, ${firstName}!` : c.stepDoneGreeting + "!"}
        </Typography>
        {/* stepDoneTitle is here so tests can find it */}
        <Typography variant="body2" color="text.secondary">
          {c.stepDoneTitle}
        </Typography>
      </Stack>

      {/* Summary card */}
      <Box
        sx={{
          width: "100%",
          p: 2.5,
          borderRadius: 3,
          background: brandGradientAlpha(theme, 0.05, 0.04),
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.12),
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${fadeUp} 0.4s ease-out both`,
            animationDelay: "0.28s",
          },
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            src={src}
            alt={c.avatarPreviewAlt}
            sx={{
              width: 72,
              height: 72,
              fontSize: 24,
              background: brandGradient(theme),
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {!src && getAvatarInitials(fullName)}
          </Avatar>

          <Stack spacing={0.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {fullName || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
              {email}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "center" }}>
            {timezone && (
              <Chip
                icon={<PublicOutlined sx={{ fontSize: "0.85rem !important" }} />}
                label={timezone}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.7rem" }}
              />
            )}
            <Chip
              icon={<WorkspacesOutlined sx={{ fontSize: "0.85rem !important" }} />}
              label={c.stepDoneProfileComplete}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: "0.7rem" }}
            />
          </Stack>
        </Stack>
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          "@media (prefers-reduced-motion: no-preference)": {
            animation: `${fadeUp} 0.4s ease-out both`,
            animationDelay: "0.4s",
          },
        }}
      >
        {c.stepDoneSubtitle}
      </Typography>
    </Stack>
  );
}
