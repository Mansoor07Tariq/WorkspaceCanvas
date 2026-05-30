import {
  Box,
  FormControlLabel,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import { CANVAS_GRID_SIZES } from "../utils/coordinateHelpers";

const c = en.app.layoutObjects;

interface Props {
  showGrid: boolean;
  onShowGridChange: (v: boolean) => void;
  snapEnabled: boolean;
  onSnapChange: (v: boolean) => void;
  gridSize: number;
  onGridSizeChange: (v: number) => void;
  canManageLayout: boolean;
}

export function LayoutCanvasToolbar({
  showGrid,
  onShowGridChange,
  snapEnabled,
  onSnapChange,
  gridSize,
  onGridSizeChange,
  canManageLayout,
}: Props) {
  return (
    <Box
      data-testid="canvas-toolbar"
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        px: 1.5,
        py: 0.75,
        mb: 1,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      {/* Show grid — available to everyone */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showGrid}
            onChange={(e) => onShowGridChange(e.target.checked)}
          />
        }
        label={<Typography variant="caption">{c.toolbarShowGrid}</Typography>}
        sx={{ m: 0 }}
      />

      {/* Snap + grid size — editors only */}
      {canManageLayout && (
        <>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={snapEnabled}
                onChange={(e) => onSnapChange(e.target.checked)}
              />
            }
            label={<Typography variant="caption">{c.toolbarSnapToGrid}</Typography>}
            sx={{ m: 0 }}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {c.toolbarGridSize}
            </Typography>
            <ToggleButtonGroup
              value={gridSize}
              exclusive
              onChange={(_, v) => {
                if (v !== null) onGridSizeChange(v as number);
              }}
              size="small"
              aria-label={c.toolbarGridSize}
            >
              {CANVAS_GRID_SIZES.map((s) => (
                <ToggleButton
                  key={s}
                  value={s}
                  aria-label={`${s} px`}
                  sx={{ fontSize: "0.7rem", py: 0.25, px: 1, minWidth: 40 }}
                >
                  {s} px
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </>
      )}
    </Box>
  );
}
