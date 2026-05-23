import { Alert } from "@mui/material";

interface Props {
  message: string | undefined;
}

export function ErrorAlert({ message }: Props) {
  if (!message) return null;
  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}
