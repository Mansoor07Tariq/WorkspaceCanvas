import type { ReactNode } from "react";
import { Card, CardContent } from "@mui/material";
import { authCardContentSx } from "../styles/auth.styles";

interface Props {
  children: ReactNode;
}

export function AuthCard({ children }: Props) {
  return (
    <Card sx={{ width: "100%", maxWidth: 448 }}>
      <CardContent sx={authCardContentSx}>{children}</CardContent>
    </Card>
  );
}
