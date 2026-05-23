import type { ReactNode } from "react";
import { Box } from "@mui/material";

interface Props {
  children: ReactNode;
}

export function CenteredPageLayout({ children }: Props) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      {children}
    </Box>
  );
}
