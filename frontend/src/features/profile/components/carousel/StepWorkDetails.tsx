import { Stack, Typography } from "@mui/material";
import { FormTextField } from "@/components/ui/FormTextField";
import { en } from "@/i18n/en";

interface Props {
  jobTitle: string;
  phoneNumber: string;
  timezone: string;
  phoneError?: string;
  onJobTitleChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  disabled?: boolean;
}

export function StepWorkDetails({
  jobTitle,
  phoneNumber,
  timezone,
  phoneError,
  onJobTitleChange,
  onPhoneChange,
  onTimezoneChange,
  disabled,
}: Props) {
  const c = en.app.profile.carousel;
  const p = en.app.profile;
  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {c.stepWorkDetailsTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepWorkDetailsSubtitle}
        </Typography>
      </Stack>
      <FormTextField
        id="onboarding-job-title"
        label={p.jobTitle}
        value={jobTitle}
        onChange={(e) => onJobTitleChange(e.target.value)}
        disabled={disabled}
        autoComplete="organization-title"
        autoFocus
      />
      <FormTextField
        id="onboarding-phone"
        label={p.phoneNumber}
        value={phoneNumber}
        onChange={(e) => onPhoneChange(e.target.value)}
        error={phoneError}
        disabled={disabled}
        autoComplete="tel"
        inputMode="tel"
      />
      <Stack spacing={0.5}>
        <FormTextField
          id="onboarding-timezone"
          label={c.timezoneLabel}
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          disabled={disabled}
        />
        <Typography variant="caption" color="text.secondary">
          {c.timezoneHelper}
        </Typography>
      </Stack>
    </Stack>
  );
}
