import { Chip, Stack, TextField } from "@mui/material";
import { en } from "@/i18n/en";
import { todayLocalDate, tomorrowLocalDate } from "../utils/bookingValidation";

const c = en.bookings;

interface Props {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  error?: string;
}

export function BookingDateSelector({ value, onChange, minDate, maxDate, disabled, error }: Props) {
  return (
    <Stack spacing={1} sx={{ minWidth: 200 }}>
      <TextField
        id="booking-date-input"
        label={c.dateLabel}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: minDate, max: maxDate },
        }}
        size="small"
      />
      <Stack direction="row" spacing={1}>
        <Chip
          label={c.dateToday}
          size="small"
          variant={value === todayLocalDate() ? "filled" : "outlined"}
          color={value === todayLocalDate() ? "primary" : "default"}
          disabled={disabled}
          onClick={() => onChange(todayLocalDate())}
          data-testid="date-chip-today"
        />
        <Chip
          label={c.dateTomorrow}
          size="small"
          variant={value === tomorrowLocalDate() ? "filled" : "outlined"}
          color={value === tomorrowLocalDate() ? "primary" : "default"}
          disabled={disabled}
          onClick={() => onChange(tomorrowLocalDate())}
          data-testid="date-chip-tomorrow"
        />
      </Stack>
    </Stack>
  );
}
