import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { BRAND_NAME } from "@/config/brand";
import { CenteredPageLayout } from "@/components/layout/CenteredPageLayout";
import { AuthCard } from "./AuthCard";
import {
  authShellHeaderSx,
  authShellBrandSx,
  authShellTitleSx,
  authShellSubtitleSx,
  authShellFooterSx,
} from "../styles/authShell.styles";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthPageShell({ title, subtitle, children, footer }: Props) {
  return (
    <CenteredPageLayout>
      <AuthCard>
        <Box sx={authShellHeaderSx}>
          <Typography variant="h6" sx={authShellBrandSx}>
            {BRAND_NAME}
          </Typography>
          <Typography variant="h5" sx={authShellTitleSx}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={authShellSubtitleSx}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
        {footer && (
          <Typography variant="body2" sx={authShellFooterSx}>
            {footer}
          </Typography>
        )}
      </AuthCard>
    </CenteredPageLayout>
  );
}
