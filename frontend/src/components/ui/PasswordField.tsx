import { useState, type ChangeEvent } from "react";
import { TextField, InputAdornment, IconButton } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  autoComplete,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      id={id}
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={onChange}
      error={Boolean(error)}
      helperText={error}
      disabled={disabled}
      autoComplete={autoComplete}
      slotProps={{
        formHelperText: error ? { role: "alert" } : {},
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible((v) => !v)}
                edge="end"
                disabled={disabled}
                size="small"
              >
                {visible ? (
                  <VisibilityOffIcon fontSize="small" />
                ) : (
                  <VisibilityIcon fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
