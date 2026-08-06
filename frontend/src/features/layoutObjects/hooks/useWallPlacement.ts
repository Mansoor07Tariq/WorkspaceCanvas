import { useCallback, useEffect, useRef, useState } from "react";
import type Konva from "konva";
import {
  snapToWall,
  getMountDimensions,
  isWallMountedType,
  nearestWall,
  projectAlong,
  pointOnWall,
  openingsOnWall,
  isAlongFree,
  clampAlongWithinGap,
  type SnapWall,
  type WallPlacement,
} from "../utils/wallPlacement";
import { getLayoutObjectRenderConfig } from "../utils/layoutObjectRenderConfig";
import type { LayoutObject, LayoutObjectType } from "../types/layoutObject.types";

interface Params {
  pendingPlacementType?: LayoutObjectType | "" | null;
  canManageLayout: boolean;
  isBookingMode: boolean;
  objects: LayoutObject[];
  /** The memoised snap walls (PR 068 — hoisted so it isn't recomputed per object). */
  snapWalls: SnapWall[];
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
 * bounds). PR 068 (FE-3): the snap walls are now passed in already memoised, so the
 * O(walls × objects) `getSnapWalls` is computed once per render instead of once per
 * wall-mounted object, and `wallDragBoundFor` is referentially STABLE (reads the
 * latest walls/objects via a ref) so it doesn't invalidate the memoised object nodes.
 */
export function useWallPlacement({
  pendingPlacementType,
  canManageLayout,
  isBookingMode,
  objects,
  snapWalls,
  onPlaceObject,
}: Params) {
  const placementType =
    pendingPlacementType && isWallMountedType(pendingPlacementType) ? pendingPlacementType : null;
  const isPlacing = !!placementType && canManageLayout && !isBookingMode;
  const [ghost, setGhost] = useState<WallPlacement | null>(null);

  const mount = placementType ? getMountDimensions(placementType) : null;
  const placementConfig = placementType ? getLayoutObjectRenderConfig(placementType) : null;

  // Latest walls/objects for the STABLE wallDragBoundFor below. Synced after commit;
  // walls do not change during a door drag, so the bound never uses a stale wall set.
  const latest = useRef({ snapWalls, objects });
  useEffect(() => {
    latest.current = { snapWalls, objects };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function computeGhost(e: any): WallPlacement | null {
    if (!isPlacing || !mount) return null;
    const stage = e.target.getStage();
    // Pointer in world coords (inverse of the viewport transform) — keeps
    // placement correct under any pan/zoom.
    const pointer = stage?.getRelativePointerPosition?.();
    if (!pointer) return null;
    const placement = snapToWall(pointer.x, pointer.y, snapWalls, mount.length);
    if (!placement) return null;
    // Disallow placing on top of an existing door/window on the same wall.
    const host = nearestWall(snapWalls, placement.centerX, placement.centerY);
    if (host) {
      const along = projectAlong(host, placement.centerX, placement.centerY);
      if (!isAlongFree(along, mount.length / 2, openingsOnWall(host, objects, -1))) return null;
    }
    return placement;
  }

  // Build a Konva dragBoundFunc for a placed door/window so it only slides along
  // its host wall (and never over another opening). Returns undefined when the
  // object is not on a wall. STABLE identity (PR 068): reads the latest walls/objects
  // via `latest`, so the memoised object nodes are not invalidated between renders.
  const wallDragBoundFor = useCallback((obj: LayoutObject) => {
    const { snapWalls, objects } = latest.current;
    const w = parseFloat(obj.width);
    const h = parseFloat(obj.height);
    const cx = parseFloat(obj.x) + w / 2;
    const cy = parseFloat(obj.y) + h / 2;
    const host = nearestWall(snapWalls, cx, cy);
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
  }, []);

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
