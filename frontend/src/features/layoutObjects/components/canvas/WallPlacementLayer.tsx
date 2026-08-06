import { Layer, Rect } from "react-konva";
import { getMountDimensions, type WallPlacement } from "../../utils/wallPlacement";
import { getLayoutObjectRenderConfig } from "../../utils/layoutObjectRenderConfig";

interface Props {
  mount: NonNullable<ReturnType<typeof getMountDimensions>>;
  placementConfig: ReturnType<typeof getLayoutObjectRenderConfig>;
  ghost: WallPlacement | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMove: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLeave: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick: (e: any) => void;
}

/**
 * Door/window wall-placement overlay (PR 061): a transparent capture rect on top
 * intercepts hover/click so placement is not stolen by object selection, plus a
 * ghost preview snapped to the nearest wall. Extracted from FloorMapCanvas
 * (PR 067); behaviour unchanged. Only mounted while actively placing.
 */
export function WallPlacementLayer({
  mount,
  placementConfig,
  ghost,
  onMove,
  onLeave,
  onClick,
}: Props) {
  return (
    <Layer>
      <Rect
        x={-1e5}
        y={-1e5}
        width={2e5}
        height={2e5}
        fill="transparent"
        onMouseMove={onMove}
        onMouseDown={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
        onTap={onClick}
        data-testid="wall-placement-capture"
      />
      {ghost && (
        <Rect
          x={ghost.centerX}
          y={ghost.centerY}
          offsetX={mount.length / 2}
          offsetY={ghost.thickness / 2}
          width={mount.length}
          height={ghost.thickness}
          rotation={ghost.angleDeg}
          fill={placementConfig.fill}
          stroke={placementConfig.stroke}
          strokeWidth={2}
          dash={[4, 3]}
          opacity={0.6}
          listening={false}
        />
      )}
    </Layer>
  );
}
