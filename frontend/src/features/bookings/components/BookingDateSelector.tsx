import { TextField } from "@mui/material";

interface Props {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
  disabled?: boolean;
  error?: string;
}

export function BookingDateSelector({ value, onChange, minDate, disabled, error }: Props) {
  return (
    <TextField
      id="booking-date-input"
      label="Booking Date"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { min: minDate },
      }}
      size="small"
    />
  );
}
