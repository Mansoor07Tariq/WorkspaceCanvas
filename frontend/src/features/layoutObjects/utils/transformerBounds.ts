/** The box shape Konva's Transformer `boundBoxFunc` receives (absolute px). */
export interface TransformBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Build a Konva Transformer `boundBoxFunc` that rejects a resize below `minSize`
 * in WORLD units. `newBox` is in absolute (zoom-scaled) screen px, so we divide
 * out the stage scale before comparing — this keeps the minimum constant at any
 * zoom (FE-6). Extracted verbatim from FloorMapCanvas (PR 067).
 */
export function makeMinSizeBoundBox(minSize: number, scale: number) {
  return (oldBox: TransformBox, newBox: TransformBox): TransformBox => {
    const s = scale || 1;
    if (newBox.width / s < minSize || newBox.height / s < minSize) {
      return oldBox;
    }
    return newBox;
  };
}
