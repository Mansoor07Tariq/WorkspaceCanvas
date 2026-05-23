import { type ChangeEvent } from "react";
import { TextField } from "@mui/material";

interface Props {
  id: string;
  label: string;
  type?: "text" | "email";
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoFocus?: boolean;
  maxLength?: number;
}

export function FormTextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  disabled,
  autoComplete,
  placeholder,
  inputMode,
  autoFocus,
  maxLength,
}: Props) {
  return (
    <TextField
      id={id}
      label={label}
      type={type}
      value={value}
      onChange={onChange}
      error={Boolean(error)}
      helperText={error}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder}
      autoFocus={autoFocus}
      slotProps={{
        formHelperText: error ? { role: "alert" } : {},
        htmlInput: {
          ...(inputMode !== undefined ? { inputMode } : {}),
          ...(maxLength !== undefined ? { maxLength } : {}),
        },
      }}
    />
  );
}
