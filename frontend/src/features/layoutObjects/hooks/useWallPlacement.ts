import { useState } from "react";
import type Konva from "konva";
import {
  getSnapWalls,
  snapToWall,
  getMountDimensions,
  isWallMountedType,
  nearestWall,
  projectAlong,
  pointOnWall,
  openingsOnWall,
  isAlongFree,
  clampAlongWithinGap,
  type WallPlacement,
} from "../utils/wallPlacement";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import type { FloorBoundary } from "../utils/coordinateHelpers";
import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";

interface Params {
  pendingPlacementType?: LayoutObjectType | "" | null;
  canManageLayout: boolean;
  isBookingMode: boolean;
  objects: LayoutObject[];
  boundary: FloorBoundary;
  carveShape: boolean;
  cutoutRects: ReturnType<typeof import("../utils/floorShape").getCutoutRects>;
  onPlaceObject?: (
    type: LayoutObjectType,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ) => void;
}

/**
 * Door/window wall-placement mode (hover-to-place ghost + slide-along-wall drag
 * bounds), extracted from FloorMapCanvas (PR 067). Behaviour unchanged — the code
 * is moved verbatim. The orchestrator renders the ghost/capture overlay from the
 * returned state and passes `wallDragBoundFor` to each placed opening node.
 */
export function useWallPlacement({
  pendingPlacementType,
  canManageLayout,
  isBookingMode,
  objects,
  boundary: B,
  carveShape,
  cutoutRects,
  onPlaceObject,
}: Params) {
  const placementType =
    pendingPlacementType && isWallMountedType(pendingPlacementType) ? pendingPlacementType : null;
  const isPlacing = !!placementType && canManageLayout && !isBookingMode;
  const [ghost, setGhost] = useState<WallPlacement | null>(null);

  const mount = placementType ? getMountDimensions(placementType) : null;
  const placementConfig = placementType ? getLayoutObjectRenderConfig(placementType) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function computeGhost(e: any): WallPlacement | null {
    if (!isPlacing || !mount) return null;
    const stage = e.target.getStage();
    // Pointer in world coords (inverse of the viewport transform) — keeps
    // placement correct under any pan/zoom.
    const pointer = stage?.getRelativePointerPosition?.();
    if (!pointer) return null;
    const walls = getSnapWalls(objects, B, carveShape ? cutoutRects : []);
    const placement = snapToWall(pointer.x, pointer.y, walls, mount.length);
    if (!placement) return null;
    // Disallow placing on top of an existing door/window on the same wall.
    const host = nearestWall(walls, placement.centerX, placement.centerY);
    if (host) {
      const along = projectAlong(host, placement.centerX, placement.centerY);
      if (!isAlongFree(along, mount.length / 2, openingsOnWall(host, objects, -1))) return null;
    }
    return placement;
  }

  // Build a Konva dragBoundFunc for a placed door/window so it only slides along
  // its host wall (and never over another opening). Returns undefined when the
  // object is not on a wall. Captures the object's pre-drag state; obj.x/y do not
  // change until dragend, so the closure stays valid for the whole drag.
  function wallDragBoundFor(obj: LayoutObject) {
    const walls = getSnapWalls(objects, B, carveShape ? cutoutRects : []);
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const cx = parseFloat(obj.x) + w / 2;
    const cy = parseFloat(obj.y) + h / 2;
    const host = nearestWall(walls, cx, cy);
    if (!host) return undefined;
    const halfLen = w / 2;
    const wallHalfLen = host.length / 2;
    const anchor = projectAlong(host, cx, cy);
    const intervals = openingsOnWall(host, objects, obj.id);
    // Regular function: Konva calls it with `this` bound to the dragged node.
    return function (this: Konva.Node, pos: { x: number; y: number }) {
      const stage = this?.getStage?.();
      const scale = stage ? stage.scaleX() : 1;
      const ox = stage ? stage.x() : 0;
      const oy = stage ? stage.y() : 0;
      const wx = (pos.x - ox) / scale;
      const wy = (pos.y - oy) / scale;
      const along = clampAlongWithinGap(
        projectAlong(host, wx, wy),
        halfLen,
        wallHalfLen,
        intervals,
        anchor
      );
      const p = pointOnWall(host, along);
      return { x: p.x * scale + ox, y: p.y * scale + oy };
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementMove(e: any) {
    const next = computeGhost(e);
    setGhost(next);
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = next ? "copy" : "not-allowed";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementLeave(e: any) {
    setGhost(null);
    const stage = e.target?.getStage?.();
    if (stage) stage.container().style.cursor = "default";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handlePlacementClick(e: any) {
    if (!placementType || !mount || !onPlaceObject) return;
    const placement = computeGhost(e) ?? ghost;
    if (!placement) return;
    // The opening matches the host wall's thickness so it sits flush over it.
    onPlaceObject(
      placementType,
      placement.centerX - mount.length / 2,
      placement.centerY - placement.thickness / 2,
      mount.length,
      placement.thickness,
      placement.angleDeg
    );
  }

  return {
    isPlacing,
    placementType,
    mount,
    placementConfig,
    ghost,
    wallDragBoundFor,
    handlePlacementMove,
    handlePlacementLeave,
    handlePlacementClick,
  };
}
