import { wheelZoomFactor } from "../utils/canvasViewport";
import { useCanvasViewport } from "./useCanvasViewport";

/**
 * Local pan/zoom camera plus the Stage event handlers that drive it (PR 061),
 * extracted from FloorMapCanvas (PR 067). Wraps `useCanvasViewport` and adds
 * cursor-anchored wheel zoom and empty-canvas pan. Behaviour unchanged.
 */
export function useCanvasStageControls() {
  const vp = useCanvasViewport();

  // Wheel / trackpad zoom, anchored to the cursor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleWheel(e: any) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    vp.zoomAt(wheelZoomFactor(e.evt.deltaY), pointer.x, pointer.y);
  }

  // Empty-canvas pan. The Stage is draggable; dragging an object or a transformer
  // anchor drags THAT node instead (Konva drags the top-most draggable target),
  // and those dragend events bubble here — so we sync the viewport only when the
  // Stage itself was the dragged node.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStageDragEnd(e: any) {
    const stage = e.target.getStage();
    if (e.target !== stage) return;
    vp.setViewport({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
  }

  return { ...vp, handleWheel, handleStageDragEnd };
}
