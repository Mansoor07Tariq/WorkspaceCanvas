import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { AddOutlined, RemoveOutlined, CenterFocusStrongOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import { formatZoomPercent, MIN_SCALE, MAX_SCALE } from "../utils/canvasViewport";

const c = en.app.layoutObjects;

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/**
 * Screen-space pan/zoom controls overlaid on the floor map (PR 061). Rendered
 * outside Konva as plain MUI so it never scales with the canvas, and shown in
 * every mode (editor, member read-only, booking). Positioned absolutely by the
 * parent's relative container.
 */
export function CanvasZoomControls({ scale, onZoomIn, onZoomOut, onReset }: Props) {
  // Floating-point scale can sit a hair past the limit after repeated steps;
  // compare with a small epsilon so the buttons disable exactly at the edges.
  const atMax = scale >= MAX_SCALE - 1e-6;
  const atMin = scale <= MIN_SCALE + 1e-6;

  return (
    <Box
      data-testid="canvas-zoom-controls"
      role="group"
      aria-label={c.zoomControlsLabel}
      sx={{
        position: "absolute",
        right: 12,
        bottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.5,
        py: 0.25,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        boxShadow: 1,
      }}
    >
      <Tooltip title={c.zoomOut}>
        <span>
          <IconButton size="small" onClick={onZoomOut} disabled={atMin} aria-label={c.zoomOut}>
            <RemoveOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Typography
        variant="caption"
        aria-label={c.zoomPercentLabel}
        sx={{ minWidth: 40, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
      >
        {formatZoomPercent(scale)}
      </Typography>

      <Tooltip title={c.zoomIn}>
        <span>
          <IconButton size="small" onClick={onZoomIn} disabled={atMax} aria-label={c.zoomIn}>
            <AddOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={c.zoomReset}>
        <span>
          <IconButton size="small" onClick={onReset} aria-label={c.zoomReset}>
            <CenterFocusStrongOutlined fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
