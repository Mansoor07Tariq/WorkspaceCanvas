import { Layer, Rect } from "react-konva";
import { ROOM_WALL_COLOR } from "./canvasStyle";
import type { RoomFrameSegment } from "../../utils/roomFrames";

interface Props {
  roomFrames: RoomFrameSegment[];
}

/**
 * Thin walls around rooms/zones — enhanced/booking view only, so they frame each
 * room as an enclosed space. Gone on revert. Extracted from FloorMapCanvas
 * (PR 067); behaviour unchanged.
 */
export function RoomFramesLayer({ roomFrames }: Props) {
  return (
    <Layer listening={false}>
      {roomFrames.map((s) => (
        <Rect
          key={`room-wall-${s.key}`}
          x={s.x}
          y={s.y}
          width={s.width}
          height={s.height}
          fill={ROOM_WALL_COLOR}
          data-testid="room-wall"
        />
      ))}
    </Layer>
  );
}
