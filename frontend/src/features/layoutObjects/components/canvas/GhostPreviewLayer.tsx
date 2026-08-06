import { Layer, Rect, Line } from "react-konva";
import { GHOST_COLOR, GHOST_FILL } from "./canvasStyle";
import type { GhostPreview } from "../../enhancePreview/buildGhostPreview";

interface Props {
  ghosts: GhostPreview[];
}

/**
 * Tidy ghost-preview overlay (PR 069). Draws, for each selected operation, a dashed
 * violet outline at the object's PROPOSED geometry (position/size/rotation) plus a
 * thin dashed connector from the object's current centre to the ghost centre when it
 * moves. Purely visual: the layer is `listening={false}`, so ghosts never intercept
 * canvas events, are never clickable/draggable, and persist nothing.
 *
 * Z-order (set by FloorMapCanvas): ABOVE the objects layer (so ghosts read on top of
 * the real objects) and BELOW the drag-guides layer.
 */
export function GhostPreviewLayer({ ghosts }: Props) {
  return (
    <Layer listening={false}>
      {/* Connectors first so the ghost outlines sit on top of them. */}
      {ghosts.map((g) =>
        g.moved ? (
          <Line
            key={`ghost-link-${g.objectId}`}
            points={[
              g.before.x + g.before.width / 2,
              g.before.y + g.before.height / 2,
              g.after.x + g.after.width / 2,
              g.after.y + g.after.height / 2,
            ]}
            stroke={GHOST_COLOR}
            strokeWidth={1}
            dash={[5, 4]}
            opacity={0.7}
            listening={false}
          />
        ) : null
      )}
      {ghosts.map((g) => {
        // Draw the outline centred at the proposed centre with a half-size offset, so
        // `rotation` pivots about the centre — exactly like a real object node.
        const cx = g.after.x + g.after.width / 2;
        const cy = g.after.y + g.after.height / 2;
        return (
          <Rect
            key={`ghost-${g.objectId}`}
            x={cx}
            y={cy}
            offsetX={g.after.width / 2}
            offsetY={g.after.height / 2}
            width={g.after.width}
            height={g.after.height}
            rotation={g.after.rotation}
            stroke={GHOST_COLOR}
            strokeWidth={1.5}
            dash={[6, 4]}
            fill={GHOST_FILL}
            listening={false}
            data-testid="tidy-ghost"
          />
        );
      })}
    </Layer>
  );
}
