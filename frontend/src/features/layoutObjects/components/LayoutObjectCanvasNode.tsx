import { Group, Rect, Circle, Text } from "react-konva";
import {
  SELECTED_STROKE,
  SELECTED_STROKE_WIDTH,
  getLayoutObjectRenderConfig,
} from "../utils/layoutObjectRenderConfig";
import { getTopLeftFromCenterPosition } from "../utils/coordinateHelpers";
import type { LayoutObject } from "../types/layoutObject.types";

interface Props {
  obj: LayoutObject;
  isSelected: boolean;
  onSelect: () => void;
  draggable?: boolean;
  onDragEnd?: (objectId: number, newX: number, newY: number) => void;
  isSaving?: boolean;
}

const LABEL_FONT_SIZE = 11;
const LABEL_PADDING = 3;
const LABEL_FILL = "#1F2937";

export function LayoutObjectCanvasNode({
  obj,
  isSelected,
  onSelect,
  draggable = false,
  onDragEnd,
  isSaving = false,
}: Props) {
  const w = parseFloat(obj.width);
  const h = parseFloat(obj.height);
  const x = parseFloat(obj.x);
  const y = parseFloat(obj.y);
  const rotation = parseFloat(obj.rotation);

  const config = getLayoutObjectRenderConfig(obj.object_type);
  const displayLabel = obj.label || config.shortCode;

  const stroke = isSelected ? SELECTED_STROKE : config.stroke;
  const strokeWidth = isSelected ? SELECTED_STROKE_WIDTH : config.strokeWidth;

  const shapeProps = {
    fill: config.fill,
    stroke,
    strokeWidth,
    opacity: isSaving ? config.opacity * 0.65 : config.opacity,
    dash: config.dashPattern.length > 0 ? config.dashPattern : undefined,
  };

  // Group origin at center of bounding box for correct rotation and drag
  const cx = x + w / 2;
  const cy = y + h / 2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleDragEnd(e: any) {
    if (!onDragEnd) return;
    const newCenterX = e.target.x();
    const newCenterY = e.target.y();
    const { x: topLeftX, y: topLeftY } = getTopLeftFromCenterPosition(newCenterX, newCenterY, w, h);
    onDragEnd(obj.id, topLeftX, topLeftY);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleMouseEnter(e: any) {
    if (!draggable) return;
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = "grab";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleMouseLeave(e: any) {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = "default";
  }

  return (
    <Group
      x={cx}
      y={cy}
      rotation={rotation}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onSelect}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {config.shape === "circle" ? (
        <Circle x={0} y={0} radius={Math.min(w, h) / 2} {...shapeProps} />
      ) : (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={config.cornerRadius}
          {...shapeProps}
        />
      )}
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        text={displayLabel}
        fontSize={LABEL_FONT_SIZE}
        fontFamily="sans-serif"
        fill={LABEL_FILL}
        align="center"
        verticalAlign="middle"
        padding={LABEL_PADDING}
        ellipsis
        wrap="none"
        listening={false}
      />
    </Group>
  );
}
