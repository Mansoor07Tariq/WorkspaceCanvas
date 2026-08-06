import { Box } from "@mui/material";
import type { NotesTooltipAnchor } from "../../hooks/useNotesTooltip";

interface Props {
  tooltip: NotesTooltipAnchor;
}

/**
 * HTML notes tooltip anchored under a hovered desk (enhanced/booking views).
 * Rendered outside the Konva Stage so it can use rich HTML. Extracted from
 * FloorMapCanvas (PR 067); markup and styling unchanged.
 */
export function NotesTooltip({ tooltip }: Props) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: tooltip.left,
        top: tooltip.top,
        transform: "translateX(-50%)",
        zIndex: 4,
        pointerEvents: "none",
        maxWidth: 240,
      }}
    >
      <Box
        sx={{
          position: "relative",
          mt: "7px",
          bgcolor: "rgba(17,24,39,0.96)",
          color: "#fff",
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          boxShadow: 6,
          fontSize: "0.75rem",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textAlign: "left",
          "&::before": {
            content: '""',
            position: "absolute",
            top: "-5px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: "5px solid rgba(17,24,39,0.96)",
          },
        }}
      >
        {tooltip.label && <Box sx={{ fontWeight: 700, mb: 0.25 }}>{tooltip.label}</Box>}
        {tooltip.notes}
      </Box>
    </Box>
  );
}
