import { useState } from "react";
import type Konva from "konva";
import { computeNeighborSnap, type SnapGuide } from "../utils/objectSnapping";
import type { LayoutObject } from "../types/layoutObject.types";

interface Params {
  objects: LayoutObject[];
  nodeRefs: React.MutableRefObject<Map<number, Konva.Group>>;
  onObjectDragEnd?: (
    objectId: number,
    newX: number,
    newY: number
  ) => { x: number; y: number } | undefined | void;
}

/**
 * Live alignment guides while dragging a normal object (PR 061), extracted from
 * FloorMapCanvas (PR 067). Owns the guide state, the per-move snap that repositions
 * the Konva node to the aligned spot, and the drag-end settle/revert. Behaviour is
 * unchanged — this only moves the code out of the component.
 */
export function useDragGuides({ objects, nodeRefs, onObjectDragEnd }: Params) {
  const [dragGuides, setDragGuides] = useState<SnapGuide[]>([]);

  // Snap the dragged node to nearby objects live and surface the guide lines.
  function handleObjectDragMove(obj: LayoutObject, node: Konva.Node) {
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const rot = parseFloat(obj.rotation) || 0;
    // Node position is the object's centre (group origin); convert to top-left.
    const { x, y, guides } = computeNeighborSnap(
      node.x() - w / 2,
      node.y() - h / 2,
      w,
      h,
      rot,
      objects,
      obj.id
    );
    node.position({ x: x + w / 2, y: y + h / 2 });
    setDragGuides(guides);
  }

  // Drag-end for normal objects: clear guides, persist via the hook, then settle
  // the Konva node on the hook's final position. The imperative reposition is
  // required because react-konva does not reliably reconcile a node back to a
  // controlled position after a drag — this is what makes push-aside and the
  // revert-on-multi-overlap actually move the node on screen.
  function handleObjectDragEndChecked(id: number, x: number, y: number) {
    setDragGuides([]);
    const final = onObjectDragEnd?.(id, x, y);
    if (!final) return;
    const obj = objects.find((o) => o.id === id);
    const node = nodeRefs.current.get(id);
    if (obj && node) {
      const w = parseFloat(obj.width);
      const h = parseFloat(obj.height);
      node.position({ x: final.x + w / 2, y: final.y + h / 2 });
      node.getLayer()?.batchDraw();
    }
  }

  return { dragGuides, handleObjectDragMove, handleObjectDragEndChecked };
}
