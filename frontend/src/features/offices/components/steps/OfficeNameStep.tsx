import { Stack, Typography } from "@mui/material";
import { FormTextField } from "@/components/ui/FormTextField";
import { en } from "@/i18n/en";

interface Props {
  name: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const c = en.app.offices;

export function OfficeNameStep({ name, onChange, error, disabled }: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.stepNameTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepNameSubtitle}
        </Typography>
      </Stack>
      <FormTextField
        id="office-name"
        label={c.nameLabel}
        placeholder={c.namePlaceholder}
        value={name}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
        autoFocus
        maxLength={255}
      />
    </Stack>
  );
}
