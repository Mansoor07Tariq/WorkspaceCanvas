import { useCallback, useEffect, useRef } from "react";
import type Konva from "konva";
import { computeNeighborSnap } from "../utils/objectSnapping";
import type { DragGuidesHandle } from "../components/canvas/DragGuidesLayer";
import type { LayoutObject } from "../types/layoutObject.types";

interface Params {
  objects: LayoutObject[];
  nodeRefs: React.MutableRefObject<Map<number, Konva.Group>>;
  onObjectDragEnd?: (
    objectId: number,
    newX: number,
    newY: number
  ) => { x: number; y: number } | undefined | void;
  /** Imperative handle to the guides layer (PR 068 — drawn without React state). */
  guidesRef: React.RefObject<DragGuidesHandle | null>;
}

/**
 * Live alignment guides while dragging a normal object (PR 061), rewired to draw
 * IMPERATIVELY (PR 068, FE-3): the per-move snap still runs, but the guide lines are
 * pushed straight into the Konva guides layer via `guidesRef` — no per-mousemove
 * setState, so a drag no longer re-renders the React tree. State is touched only at
 * drag end (the existing optimistic persist path). The two handlers are stable
 * (identity never changes) and read the latest `objects`/`onObjectDragEnd` through a
 * ref, so memoised object nodes are not invalidated between drags.
 */
export function useDragGuides({ objects, nodeRefs, onObjectDragEnd, guidesRef }: Params) {
  // Latest reactive inputs, so the handlers below can stay referentially stable
  // (empty-ish deps) while always operating on current data. Synced after commit;
  // both handlers run on drag events (post-commit), so they never see a stale value.
  const latest = useRef({ objects, onObjectDragEnd });
  useEffect(() => {
    latest.current = { objects, onObjectDragEnd };
  });

  // Snap the dragged node to nearby objects live and draw the guide lines directly.
  const handleObjectDragMove = useCallback(
    (obj: LayoutObject, node: Konva.Node) => {
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
        latest.current.objects,
        obj.id
      );
      node.position({ x: x + w / 2, y: y + h / 2 });
      guidesRef.current?.setGuides(guides);
    },
    [guidesRef]
  );

  // Drag-end for normal objects: clear guides (covers both settle AND revert), persist
  // via the hook, then settle the Konva node on the hook's final position. The
  // imperative reposition is required because react-konva does not reliably reconcile
  // a node back to a controlled position after a drag — this is what makes push-aside
  // and the revert-on-multi-overlap actually move the node on screen.
  const handleObjectDragEndChecked = useCallback(
    (id: number, x: number, y: number) => {
      guidesRef.current?.clear();
      const { objects, onObjectDragEnd } = latest.current;
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
    },
    [guidesRef, nodeRefs]
  );

  return { handleObjectDragMove, handleObjectDragEndChecked };
}
