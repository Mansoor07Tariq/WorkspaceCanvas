import type { ReactNode } from "react";
import { Box, Button, CircularProgress } from "@mui/material";

interface Props {
  children: ReactNode;
  loading: boolean;
  disabled?: boolean;
  type?: "submit" | "button" | "reset";
  onClick?: () => void;
}

export function LoadingButton({ children, loading, disabled, type = "submit", onClick }: Props) {
  return (
    <Button
      type={type}
      variant="contained"
      fullWidth
      size="large"
      disabled={loading || disabled}
      onClick={onClick}
    >
      {loading && (
        <Box component="span" sx={{ display: "inline-flex", mr: 1 }} aria-hidden="true">
          <CircularProgress size={18} color="inherit" />
        </Box>
      )}
      {children}
    </Button>
  );
}
