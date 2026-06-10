import type { ComponentType } from "react";
import type { LayoutObject } from "../types/layoutObject.types";
import type { RenderConfig } from "../utils/layoutObjectRenderConfig";
import type { LayoutObjectNodeStyle } from "../utils/layoutObjectNodeStyle";

/**
 * Props handed to every layout object renderer.
 *
 * A renderer draws ONLY the inner visual of a layout object (the base shape, and
 * later: icons/illustrations). The shared `LayoutObjectCanvasNode` owns the Konva
 * Group geometry, position, rotation, drag/transform binding, selection, label,
 * and the bookable dot — so renderers never re-implement those concerns.
 *
 * The renderer is rendered inside a Konva Group whose origin is the centre of the
 * object's bounding box. Coordinates are therefore relative to that centre:
 * a centred rect spans `[-width/2, -height/2]` to `[width/2, height/2]`.
 */
export interface LayoutObjectRendererProps {
  /** The full layout object (id, type, label, geometry, metadata). */
  object: LayoutObject;
  /** Static visual config resolved from `object.object_type`. */
  config: RenderConfig;
  /**
   * Resolved fill/stroke/opacity/dash for the current state. This already folds
   * in editor selection, saving dim, and booking-mode availability colours — a
   * renderer that spreads `style` onto its base shape keeps all of those working.
   */
  style: LayoutObjectNodeStyle;
  /** Object width in canvas units (`parseFloat(object.width)`). */
  width: number;
  /** Object height in canvas units (`parseFloat(object.height)`). */
  height: number;
  /** True when this object is the editor selection. */
  isSelected: boolean;
  /** True while an optimistic save is in flight. */
  isSaving: boolean;
  /** True when the canvas is in booking mode (read-only, availability overlay). */
  isBookingMode: boolean;
}

/**
 * A layout object renderer is a Konva-returning React component. It must render
 * react-konva shapes (Rect, Circle, Path, …) and nothing that breaks the Konva
 * scene graph (no HTML/DOM elements).
 */
export type LayoutObjectRenderer = ComponentType<LayoutObjectRendererProps>;
