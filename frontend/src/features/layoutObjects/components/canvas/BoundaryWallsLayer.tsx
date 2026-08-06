import { Layer, Rect } from "react-konva";
import { WALL_FILL, WALL_STROKE, WALL_STROKE_WIDTH } from "./canvasStyle";

interface WallSegment {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  wallSegments: WallSegment[];
  canSelectBoundary: boolean;
  onBoundaryClick: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setWallCursor: (e: any, cursor: string) => void;
}

/**
 * The four office walls (or the carve-aware wall segments), styled to match the
 * "wall" layout object. In their own listening layer so a click selects the room.
 * Extracted from FloorMapCanvas (PR 067); behaviour unchanged.
 */
export function BoundaryWallsLayer({
  wallSegments,
  canSelectBoundary,
  onBoundaryClick,
  setWallCursor,
}: Props) {
  return (
    <Layer listening={canSelectBoundary}>
      {wallSegments.map((w, i) => (
        <Rect
          key={`wall-${i}`}
          x={w.x}
          y={w.y}
          width={w.width}
          height={w.height}
          fill={WALL_FILL}
          stroke={WALL_STROKE}
          strokeWidth={WALL_STROKE_WIDTH}
          shadowColor="#000000"
          shadowOpacity={0.12}
          shadowBlur={6}
          onClick={onBoundaryClick}
          onTap={onBoundaryClick}
          onMouseEnter={(e) => setWallCursor(e, "pointer")}
          onMouseLeave={(e) => setWallCursor(e, "default")}
          data-testid="boundary-wall"
        />
      ))}
    </Layer>
  );
}
