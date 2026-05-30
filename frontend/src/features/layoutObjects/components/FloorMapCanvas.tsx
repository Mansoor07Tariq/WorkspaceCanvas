import { Stage, Layer, Rect, Line } from "react-konva";
import { Box, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import { LayoutObjectCanvasNode } from "./LayoutObjectCanvasNode";
import type { LayoutObject } from "../types/layoutObject.types";

export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 640;

const GRID_STEP = 50;
const GRID_COLOR = "#E5E7EB";
const CANVAS_BG = "#FAFAFA";
const BOUNDARY_COLOR = "#D1D5DB";

const c = en.app.layoutObjects;

interface Props {
  objects: LayoutObject[];
  selectedObjectId: number | null;
  onSelectObject: (id: number | null) => void;
  canManageLayout?: boolean;
  onObjectDragEnd?: (objectId: number, newX: number, newY: number) => void;
  savingObjectIds?: ReadonlySet<number>;
}

function buildGridLines() {
  const lines = [];
  for (let x = GRID_STEP; x < CANVAS_WIDTH; x += GRID_STEP) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, CANVAS_HEIGHT]}
        stroke={GRID_COLOR}
        strokeWidth={0.5}
        listening={false}
      />
    );
  }
  for (let y = GRID_STEP; y < CANVAS_HEIGHT; y += GRID_STEP) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[0, y, CANVAS_WIDTH, y]}
        stroke={GRID_COLOR}
        strokeWidth={0.5}
        listening={false}
      />
    );
  }
  return lines;
}

export function FloorMapCanvas({
  objects,
  selectedObjectId,
  onSelectObject,
  canManageLayout = false,
  onObjectDragEnd,
  savingObjectIds,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStageClick(e: any) {
    if (e.target === e.target.getStage()) {
      onSelectObject(null);
    }
  }

  return (
    <Box
      role="img"
      aria-label={c.canvasTitle}
      sx={{
        position: "relative",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "auto",
        lineHeight: 0,
        bgcolor: CANVAS_BG,
      }}
    >
      <Stage
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleStageClick}
        onTap={handleStageClick}
        data-testid="floor-map-stage"
      >
        <Layer listening={false}>
          <Rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={CANVAS_BG} />
          {buildGridLines()}
          <Rect
            x={2}
            y={2}
            width={CANVAS_WIDTH - 4}
            height={CANVAS_HEIGHT - 4}
            fill="transparent"
            stroke={BOUNDARY_COLOR}
            strokeWidth={1}
            dash={[4, 4]}
          />
        </Layer>
        <Layer>
          {objects.map((obj) => (
            <LayoutObjectCanvasNode
              key={obj.id}
              obj={obj}
              isSelected={obj.id === selectedObjectId}
              onSelect={() => onSelectObject(obj.id)}
              draggable={canManageLayout}
              onDragEnd={onObjectDragEnd}
              isSaving={savingObjectIds?.has(obj.id)}
            />
          ))}
        </Layer>
      </Stage>

      {objects.length === 0 && (
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
            {c.canvasEmptyTitle}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {c.canvasEmptySubtitle}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
