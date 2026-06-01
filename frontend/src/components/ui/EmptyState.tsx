import type { ReactNode } from "react";
import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionDisabledTooltip?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionDisabledTooltip,
}: Props) {
  const button = actionLabel ? (
    <Button variant="contained" onClick={onAction} disabled={actionDisabled}>
      {actionLabel}
    </Button>
  ) : null;

  const wrappedButton =
    actionDisabled && actionDisabledTooltip ? (
      <Tooltip title={actionDisabledTooltip} arrow>
        <span>{button}</span>
      </Tooltip>
    ) : (
      button
    );

  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center", maxWidth: 420 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>
        <Stack spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
        {wrappedButton}
      </Stack>
    </Box>
  );
}
