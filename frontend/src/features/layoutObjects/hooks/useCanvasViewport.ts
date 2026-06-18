import { useCallback, useState } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../utils/coordinateHelpers";
import {
  DEFAULT_VIEWPORT,
  ZOOM_STEP,
  zoomAroundPoint,
  type CanvasViewport,
} from "../utils/canvasViewport";

export interface UseCanvasViewportResult {
  viewport: CanvasViewport;
  setViewport: (next: CanvasViewport) => void;
  /** Zoom in one step, anchored to the centre of the visible canvas. */
  zoomIn: () => void;
  /** Zoom out one step, anchored to the centre of the visible canvas. */
  zoomOut: () => void;
  /** Reset to the default viewport (scale 1, origin 0,0 — the whole room fits). */
  reset: () => void;
  /** Zoom anchored to a screen point (cursor), e.g. from a wheel event. */
  zoomAt: (factor: number, focusX: number, focusY: number) => void;
}

const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;

/**
 * Local pan/zoom camera state for the floor map (PR 061). Pure viewport math
 * lives in utils/canvasViewport so it can be unit-tested without React; this
 * hook only owns the state and the convenience actions. Nothing here is
 * persisted — object world coordinates are untouched by panning/zooming.
 */
export function useCanvasViewport(): UseCanvasViewportResult {
  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_VIEWPORT);

  const zoomAt = useCallback((factor: number, focusX: number, focusY: number) => {
    setViewport((v) => zoomAroundPoint(v, factor, focusX, focusY));
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((v) => zoomAroundPoint(v, ZOOM_STEP, CENTER_X, CENTER_Y));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((v) => zoomAroundPoint(v, 1 / ZOOM_STEP, CENTER_X, CENTER_Y));
  }, []);

  const reset = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT);
  }, []);

  return { viewport, setViewport, zoomIn, zoomOut, reset, zoomAt };
}
