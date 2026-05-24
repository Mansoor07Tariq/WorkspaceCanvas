import { Chip, Stack, Typography } from "@mui/material";
import { CheckCircleOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";

interface Props {
  email: string;
  emailVerified: boolean;
}

export function StepEmail({ email, emailVerified }: Props) {
  const c = en.app.profile.carousel;
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {c.stepEmailTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepEmailSubtitle}
        </Typography>
      </Stack>
      <Stack spacing={1}>
        <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
          {email}
        </Typography>
        {emailVerified && (
          <Chip
            icon={<CheckCircleOutlined />}
            label={c.stepEmailVerifiedLabel}
            color="success"
            size="small"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          />
        )}
      </Stack>
    </Stack>
  );
}
