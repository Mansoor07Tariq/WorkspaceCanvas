import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { AutoFixHighOutlined, AutoAwesomeMosaicOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import {
  CANVAS_GRID_SIZES,
  MIN_FLOOR_BOUNDARY,
  MAX_FLOOR_BOUNDARY,
} from "../utils/coordinateHelpers";

const c = en.app.layoutObjects;

interface Props {
  showGrid: boolean;
  onShowGridChange: (v: boolean) => void;
  snapEnabled: boolean;
  onSnapChange: (v: boolean) => void;
  gridSize: number;
  onGridSizeChange: (v: number) => void;
  canManageLayout: boolean;
  enhanced: boolean;
  onEnhancedChange: (v: boolean) => void;
  /** Open the Tidy preview. Admin-only; omit to hide the Tidy button. */
  onTidy?: () => void;
  /** Current room width/height (px). Omit to hide the room-size controls. */
  boundaryWidth?: number;
  boundaryHeight?: number;
  onBoundaryWidthChange?: (v: number) => void;
  onBoundaryHeightChange?: (v: number) => void;
}

export function LayoutCanvasToolbar({
  showGrid,
  onShowGridChange,
  snapEnabled,
  onSnapChange,
  gridSize,
  onGridSizeChange,
  canManageLayout,
  enhanced,
  onEnhancedChange,
  onTidy,
  boundaryWidth,
  boundaryHeight,
  onBoundaryWidthChange,
  onBoundaryHeightChange,
}: Props) {
  const showRoomSize =
    canManageLayout &&
    boundaryWidth !== undefined &&
    boundaryHeight !== undefined &&
    !!onBoundaryWidthChange &&
    !!onBoundaryHeightChange;

  const roomSizeField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    testId: string
  ) => (
    <TextField
      label={label}
      type="number"
      size="small"
      value={Math.round(value)}
      onChange={(e) => {
        const next = parseInt(e.target.value, 10);
        if (!Number.isNaN(next)) onChange(next);
      }}
      slotProps={{
        htmlInput: {
          min: MIN_FLOOR_BOUNDARY,
          max: MAX_FLOOR_BOUNDARY,
          step: 10,
          "aria-label": label,
          "data-testid": testId,
        },
      }}
      sx={{ width: 92, "& input": { py: 0.5, fontSize: "0.75rem" } }}
    />
  );
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

      {/* Room size — editors only. Drives the same boundary the drag handles do. */}
      {showRoomSize && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            {c.toolbarRoomSize}
          </Typography>
          {roomSizeField(c.toolbarRoomWidth, boundaryWidth, onBoundaryWidthChange, "room-width")}
          <Typography variant="caption" color="text.disabled">
            ×
          </Typography>
          {roomSizeField(
            c.toolbarRoomHeight,
            boundaryHeight,
            onBoundaryHeightChange,
            "room-height"
          )}
        </Box>
      )}

      {/* Tidy layout — explicit admin action: computes a plan, previews it, then
          applies as a tracked best-effort backend run. Distinct from the
          view-only isometric toggle. */}
      {canManageLayout && onTidy && (
        <Tooltip describeChild title={c.tidyTooltip}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeMosaicOutlined />}
            onClick={onTidy}
            sx={{ ml: "auto", py: 0.25 }}
          >
            {c.tidyButton}
          </Button>
        </Tooltip>
      )}

      {/* View toggle — swaps simple boxes for detailed isometric assets. Purely
          visual and client-side: it NEVER moves, resizes, or persists objects. */}
      <Tooltip describeChild title={enhanced ? c.toolbarRevertTooltip : c.toolbarEnhanceTooltip}>
        <Button
          size="small"
          variant={enhanced ? "contained" : "outlined"}
          startIcon={<AutoFixHighOutlined />}
          onClick={() => onEnhancedChange(!enhanced)}
          aria-pressed={enhanced}
          sx={{ ml: canManageLayout && onTidy ? 1 : "auto", py: 0.25 }}
        >
          {enhanced ? c.toolbarRevert : c.toolbarEnhance}
        </Button>
      </Tooltip>
    </Box>
  );
}
