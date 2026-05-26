import { Stack, TextField, Typography } from "@mui/material";
import { en } from "@/i18n/en";

interface Props {
  allowedDomain: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const c = en.app.orgSetup;

export function OrgStepDomain({ allowedDomain, onChange, error, disabled }: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.stepDomainTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepDomainSubtitle}
        </Typography>
      </Stack>
      <TextField
        id="org-allowed-domain"
        label={c.domainLabel}
        placeholder={c.domainPlaceholder}
        value={allowedDomain}
        onChange={(e) => onChange(e.target.value)}
        error={Boolean(error)}
        helperText={error ?? c.domainSkipHint}
        slotProps={{
          formHelperText: error ? { role: "alert" } : {},
          htmlInput: { maxLength: 255 },
        }}
        disabled={disabled}
        autoFocus
      />
    </Stack>
  );
}
