import { forwardRef, useImperativeHandle, useRef } from "react";
import { Layer } from "react-konva";
import Konva from "konva";
import { GUIDE_COLOR } from "./canvasStyle";
import type { SnapGuide } from "../../utils/objectSnapping";

/** Imperative handle so the drag hook can draw/clear guides without React state. */
export interface DragGuidesHandle {
  /** Replace the drawn guide lines with `guides` (called per dragmove frame). */
  setGuides: (guides: SnapGuide[]) => void;
  /** Remove every guide line (called on dragend and on cancel/revert). */
  clear: () => void;
}

function guidePoints(g: SnapGuide): number[] {
  // "x" → vertical line at `position` spanning [from,to] in y; "y" → horizontal.
  return g.axis === "x"
    ? [g.position, g.from, g.position, g.to]
    : [g.from, g.position, g.to, g.position];
}

/**
 * Live alignment guides while dragging a normal object (PR 061), drawn
 * IMPERATIVELY (PR 068, FE-3). The layer renders no declarative children; the drag
 * hook mutates its Konva `Line` children directly on every dragmove, so a drag no
 * longer triggers a per-frame React re-render. Visuals are pixel-identical to the
 * old declarative version: same colour, width 1, dash [4,4], world-space points.
 */
export const DragGuidesLayer = forwardRef<DragGuidesHandle>(function DragGuidesLayer(_props, ref) {
  const layerRef = useRef<Konva.Layer>(null);

  useImperativeHandle(
    ref,
    () => ({
      setGuides(guides: SnapGuide[]) {
        const layer = layerRef.current;
        if (!layer) return;
        // Rebuild the (tiny, ≤ a handful) set of guide lines each frame. Konva node
        // churn here is negligible next to the React re-render it replaces, and it
        // keeps the layer child-free between frames so react-konva never reconciles
        // over these imperative nodes.
        layer.destroyChildren();
        for (const g of guides) {
          layer.add(
            new Konva.Line({
              points: guidePoints(g),
              stroke: GUIDE_COLOR,
              strokeWidth: 1,
              dash: [4, 4],
              listening: false,
            })
          );
        }
        layer.batchDraw();
      },
      clear() {
        const layer = layerRef.current;
        if (!layer) return;
        layer.destroyChildren();
        layer.batchDraw();
      },
    }),
    []
  );

  return <Layer ref={layerRef} listening={false} />;
});
