import { Alert } from "@mui/material";

interface Props {
  message: string | undefined;
}

export function SuccessAlert({ message }: Props) {
  if (!message) return null;
  return (
    <Alert severity="success" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}
