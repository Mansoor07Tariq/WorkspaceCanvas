import { Stack, Typography } from "@mui/material";
import { FormTextField } from "@/components/ui/FormTextField";
import { en } from "@/i18n/en";

interface Props {
  fullName: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function StepName({ fullName, onChange, error, disabled }: Props) {
  const c = en.app.profile.carousel;
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {c.stepNameTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepNameSubtitle}
        </Typography>
      </Stack>
      <FormTextField
        id="onboarding-full-name"
        label={en.app.profile.fullName}
        value={fullName}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
        autoComplete="name"
        autoFocus
      />
    </Stack>
  );
}
