import { Box, Typography } from "@mui/material";
import { en } from "@/i18n/en";

const c = en.app.layoutObjects;

interface Props {
  canManageLayout: boolean;
}

/**
 * Centered empty-state overlay shown when the floor has no objects. Extracted
 * from FloorMapCanvas (PR 067); copy and styling unchanged.
 */
export function CanvasEmptyState({ canManageLayout }: Props) {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        pointerEvents: "none",
      }}
    >
      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
        {canManageLayout ? c.canvasEmptyTitle : c.emptyStateMemberTitle}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {canManageLayout ? c.canvasEmptySubtitle : c.emptyStateMemberSubtitle}
      </Typography>
    </Box>
  );
}
