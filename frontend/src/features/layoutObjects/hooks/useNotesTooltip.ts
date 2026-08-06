import { useState } from "react";
import { getObjectNotes } from "../utils/layoutObjectNotes";
import type { CanvasViewport } from "../utils/canvasViewport";
import type { LayoutObject } from "../types/layoutObject.types";

export interface NotesTooltipAnchor {
  left: number;
  top: number;
  label: string;
  notes: string;
}

interface Params {
  enabled: boolean;
  objects: LayoutObject[];
  viewport: CanvasViewport;
}

/**
 * Notes tooltip on hover — shown in the "real office" views (enhanced/booking).
 * Extracted from FloorMapCanvas (PR 067); behaviour unchanged. Returns the hover
 * setter to wire onto object nodes and the resolved anchor (screen px within the
 * scroll container, mapped through the viewport so it tracks pan/zoom and accounts
 * for 90/270° rotation where the footprint height is the stored width).
 */
export function useNotesTooltip({ enabled, objects, viewport }: Params) {
  const [hoveredObjectId, setHoveredObjectId] = useState<number | null>(null);

  const notesTooltip: NotesTooltipAnchor | null = (() => {
    if (!enabled || hoveredObjectId == null) return null;
    const ho = objects.find((o) => o.id === hoveredObjectId);
    if (!ho) return null;
    const notes = getObjectNotes(ho).trim();
    if (!notes) return null;
    const ox = parseFloat(ho.x);
    const oy = parseFloat(ho.y);
    const ow = parseFloat(ho.width);
    const oh = parseFloat(ho.height);
    const rot = parseFloat(ho.rotation) || 0;
    const quarter = rot === 90 || rot === 270;
    const cx = ox + ow / 2;
    const bottomY = oy + oh / 2 + (quarter ? ow : oh) / 2;
    return {
      left: cx * viewport.scale + viewport.x,
      top: bottomY * viewport.scale + viewport.y,
      label: ho.label,
      notes,
    };
  })();

  return { hoveredObjectId, setHoveredObjectId, notesTooltip };
}
