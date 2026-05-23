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
      slotProps={{
        formHelperText: error ? { role: "alert" } : {},
      }}
    />
  );
}
