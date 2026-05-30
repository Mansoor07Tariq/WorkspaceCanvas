import { FormHelperText, Stack, Typography } from "@mui/material";
import { FormTextField } from "@/components/ui/FormTextField";
import { en } from "@/i18n/en";

const c = en.app.floors;

interface Props {
  name: string;
  nameError?: string;
  level_number: string;
  levelError?: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

export function FloorDetailsStep({
  name,
  nameError,
  level_number,
  levelError,
  onChange,
  disabled,
}: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.stepDetailsTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepDetailsSubtitle}
        </Typography>
      </Stack>
      <Stack spacing={2}>
        <FormTextField
          id="floor-name"
          label={c.nameLabel}
          placeholder={c.namePlaceholder}
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          error={nameError}
          disabled={disabled}
          maxLength={255}
        />
        <Stack spacing={0.5}>
          <FormTextField
            id="floor-level"
            label={c.levelLabel}
            placeholder={c.levelPlaceholder}
            value={level_number}
            onChange={(e) => onChange("level_number", e.target.value)}
            error={levelError}
            disabled={disabled}
            maxLength={10}
          />
          {!levelError && <FormHelperText sx={{ mx: 1.75 }}>{c.levelHelper}</FormHelperText>}
        </Stack>
      </Stack>
    </Stack>
  );
}
