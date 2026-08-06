import { Layer, Line } from "react-konva";
import { GUIDE_COLOR } from "./canvasStyle";
import type { SnapGuide } from "../../utils/objectSnapping";

interface Props {
  guides: SnapGuide[];
}

/**
 * Live alignment guides while dragging a normal object (PR 061). Extracted from
 * FloorMapCanvas (PR 067); behaviour unchanged.
 */
export function DragGuidesLayer({ guides }: Props) {
  return (
    <Layer listening={false}>
      {guides.map((g, i) => (
        <Line
          key={`guide-${i}`}
          points={
            g.axis === "x"
              ? [g.position, g.from, g.position, g.to]
              : [g.from, g.position, g.to, g.position]
          }
          stroke={GUIDE_COLOR}
          strokeWidth={1}
          dash={[4, 4]}
        />
      ))}
    </Layer>
  );
}
