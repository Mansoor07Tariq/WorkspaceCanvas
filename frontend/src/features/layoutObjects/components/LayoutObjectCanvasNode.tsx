import { Group, Rect, Circle, Text } from "react-konva";
import {
  SELECTED_STROKE,
  SELECTED_STROKE_WIDTH,
  getLayoutObjectRenderConfig,
} from "../utils/layoutObjectRenderConfig";
import type { LayoutObject } from "../types/layoutObject.types";

interface Props {
  obj: LayoutObject;
  isSelected: boolean;
  onSelect: () => void;
}

const LABEL_FONT_SIZE = 11;
const LABEL_PADDING = 3;
const LABEL_FILL = "#1F2937";

export function LayoutObjectCanvasNode({ obj, isSelected, onSelect }: Props) {
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
    opacity: config.opacity,
    dash: config.dashPattern.length > 0 ? config.dashPattern : undefined,
  };

  // Group origin at center of bounding box for correct rotation
  const cx = x + w / 2;
  const cy = y + h / 2;

  return (
    <Group x={cx} y={cy} rotation={rotation} onClick={onSelect} onTap={onSelect}>
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
