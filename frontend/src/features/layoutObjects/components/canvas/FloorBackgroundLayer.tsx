import { useMemo } from "react";
import { Layer, Rect, Line } from "react-konva";
import { CANVAS_BG, ROOM_FILL, GRID_COLOR } from "./canvasStyle";
import type { FloorBoundary } from "../../utils/coordinateHelpers";
import type { Rect as GeoRect } from "../../utils/floorShape";

interface Props {
  stageWidth: number;
  stageHeight: number;
  boundary: FloorBoundary;
  carvedCutouts: GeoRect[];
  showGrid: boolean;
  enhanced: boolean;
  gridSize: number;
}

/**
 * Non-interactive base layer: grey margin, white room interior, carved cutouts,
 * and the grid. Extracted from FloorMapCanvas (PR 067); behaviour unchanged.
 */
export function FloorBackgroundLayer({
  stageWidth,
  stageHeight,
  boundary: B,
  carvedCutouts,
  showGrid,
  enhanced,
  gridSize,
}: Props) {
  // Memoize grid lines so they only rebuild when showGrid/gridSize/size changes.
  const gridLines = useMemo(() => {
    // Enhanced view is a clean presentation — no grid.
    if (!showGrid || enhanced) return [];
    const lines = [];
    for (let x = gridSize; x < stageWidth; x += gridSize) {
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, 0, x, stageHeight]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    for (let y = gridSize; y < stageHeight; y += gridSize) {
      lines.push(
        <Line
          key={`h${y}`}
          points={[0, y, stageWidth, y]}
          stroke={GRID_COLOR}
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    return lines;
  }, [showGrid, enhanced, gridSize, stageWidth, stageHeight]);

  return (
    <Layer listening={false}>
      {/* Grey margin outside the room */}
      <Rect width={stageWidth} height={stageHeight} fill={CANVAS_BG} />
      {/* White interior of the office */}
      <Rect x={B.x} y={B.y} width={B.width} height={B.height} fill={ROOM_FILL} />
      {/* Enhanced view: carve cutouts out of the floor by painting them back to
          the outside colour, so the office reads as a non-rectangular shape. */}
      {carvedCutouts.map((r, i) => (
        <Rect
          key={`cutout-${i}`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={CANVAS_BG}
        />
      ))}
      {gridLines}
    </Layer>
  );
}
