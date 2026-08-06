import { Layer, Rect, Transformer } from "react-konva";
import type Konva from "konva";
import { BOUNDARY_HANDLE_COLOR } from "./canvasStyle";
import { MIN_FLOOR_BOUNDARY, type FloorBoundary } from "../../utils/coordinateHelpers";
import { makeMinSizeBoundBox } from "../../utils/transformerBounds";

interface Props {
  boundary: FloorBoundary;
  scale: number;
  roomResizeRef: React.RefObject<Konva.Rect | null>;
  boundaryTransformerRef: React.RefObject<Konva.Transformer | null>;
  onTransformEnd: () => void;
}

/**
 * Room-resize handles: an invisible Rect tracks the room and the Transformer draws
 * drag handles on its right/bottom/corner. Top-left is pinned (no left/top anchors)
 * so the room grows down/right from the fixed inset. Extracted from FloorMapCanvas
 * (PR 067); behaviour unchanged. The zoom-invariant min (FE-6) uses the shared
 * `makeMinSizeBoundBox` helper.
 */
export function BoundaryResizeLayer({
  boundary: B,
  scale,
  roomResizeRef,
  boundaryTransformerRef,
  onTransformEnd,
}: Props) {
  return (
    <Layer>
      <Rect
        ref={roomResizeRef}
        x={B.x}
        y={B.y}
        width={B.width}
        height={B.height}
        listening={false}
        data-testid="boundary-resize-target"
      />
      <Transformer
        ref={boundaryTransformerRef}
        rotateEnabled={false}
        keepRatio={false}
        anchorStroke={BOUNDARY_HANDLE_COLOR}
        anchorFill="#FFFFFF"
        borderStroke={BOUNDARY_HANDLE_COLOR}
        borderDash={[6, 4]}
        onTransformEnd={onTransformEnd}
        boundBoxFunc={makeMinSizeBoundBox(MIN_FLOOR_BOUNDARY, scale)}
      />
    </Layer>
  );
}
