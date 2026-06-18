import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/api/apiClient";
import { updateLayoutObject } from "../api/layoutObjectApi";
import {
  buildMovePatch,
  buildTransformPatch,
  clampObjectToBoundary,
  clampObjectTransformToBoundary,
  snapToGrid,
  snapObjectToGrid,
  snapSizeToGrid,
  snapRotation,
} from "../utils/coordinateHelpers";
import {
  isWallMountedType,
  constrainWallObjectMove,
  attachedOpenings,
  transformOpeningWithWall,
  resizeOpeningOnWall,
  nearestWall,
  getSnapWalls,
} from "../utils/wallPlacement";
import { snapToNeighbors, overlapsBlockingObject, resolveDrop } from "../utils/objectSnapping";
import type { LayoutObject } from "../types/layoutObject.types";

const c = en.app.layoutObjects;

const SAVED_DISPLAY_MS = 2000;
const KEYBOARD_STEP = 1;
const KEYBOARD_STEP_SHIFT = 10;

export interface UseCanvasInteractionsParams {
  officeId: number;
  floorId: number;
  objects: LayoutObject[];
  selectedObjectId: number | null;
  canManageLayout: boolean;
  snapEnabled: boolean;
  gridSize: number;
  savingObjectIds: ReadonlySet<number>;
  updateObjectLocally: (id: number, patch: Partial<LayoutObject>) => void;
  setSaving: (id: number, saving: boolean) => void;
}

export interface UseCanvasInteractionsResult {
  handleObjectMove: (objectId: number, x: number, y: number) => Promise<void>;
  /** Returns the final top-left so the canvas can settle/revert the node there. */
  handleObjectDragEnd: (
    objectId: number,
    rawX: number,
    rawY: number
  ) => { x: number; y: number } | undefined;
  handleObjectTransform: (
    objectId: number,
    rawX: number,
    rawY: number,
    rawWidth: number,
    rawHeight: number,
    rawRotation: number
  ) => Promise<void>;
  handleCanvasKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Error message for the last failed move/transform PATCH (undefined when none). */
  layoutSaveError: string | undefined;
  setLayoutSaveError: (value: string | undefined) => void;
  /** The object id that just saved successfully — drives the transient "Saved" chip. */
  savedObjectId: number | null;
}

/**
 * TD-019: canvas interaction logic extracted out of FloorLayoutPage so it can be
 * unit-tested in isolation. Behaviour is identical to the previous inline
 * callbacks — optimistic move/transform with rollback, snap+clamp integration,
 * keyboard movement (role/snap/clamp aware, e.repeat suppressed), saving/saved
 * feedback, and concurrent-save suppression via `savingObjectIds`.
 */
export function useCanvasInteractions({
  officeId,
  floorId,
  objects,
  selectedObjectId,
  canManageLayout,
  snapEnabled,
  gridSize,
  savingObjectIds,
  updateObjectLocally,
  setSaving,
}: UseCanvasInteractionsParams): UseCanvasInteractionsResult {
  const [layoutSaveError, setLayoutSaveError] = useState<string | undefined>(undefined);
  const [savedObjectId, setSavedObjectId] = useState<number | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the saved-flash timeout on unmount.
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const flashSaved = useCallback((id: number) => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    setSavedObjectId(id);
    savedTimeoutRef.current = setTimeout(() => setSavedObjectId(null), SAVED_DISPLAY_MS);
  }, []);

  function buildMoveError(err: unknown): string {
    return err instanceof ApiError && err.status === 403 ? c.movePermissionError : c.moveError;
  }

  // ─── Core move PATCH — receives final coordinates (already snapped/clamped) ─
  const handleObjectMove = useCallback(
    async (objectId: number, x: number, y: number) => {
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      const patch = buildMovePatch(x, y);
      updateObjectLocally(objectId, patch);
      setSaving(objectId, true);
      setLayoutSaveError(undefined);

      try {
        await updateLayoutObject(officeId, floorId, objectId, patch);
        flashSaved(objectId);
      } catch (err) {
        updateObjectLocally(objectId, { x: prevObj.x, y: prevObj.y });
        setLayoutSaveError(buildMoveError(err));
      } finally {
        setSaving(objectId, false);
      }
    },
    [officeId, floorId, objects, savingObjectIds, updateObjectLocally, setSaving, flashSaved]
  );

  // ─── Move a wall AND the doors/windows mounted on it (PR 061) ─────────────
  // Openings are "part of" the wall: when it moves, they translate by the same
  // delta so they stay on the wall at the same spot.
  const moveWallAndOpenings = useCallback(
    (wall: LayoutObject, newX: number, newY: number) => {
      const dx = newX - parseFloat(wall.x);
      const dy = newY - parseFloat(wall.y);
      const openings = dx !== 0 || dy !== 0 ? attachedOpenings(wall, objects) : [];
      handleObjectMove(wall.id, newX, newY);
      for (const op of openings) {
        handleObjectMove(op.id, parseFloat(op.x) + dx, parseFloat(op.y) + dy);
      }
    },
    [objects, handleObjectMove]
  );

  // ─── Drag-end wrapper — snap, clamp, overlap-resolve; returns the final ────
  // top-left so the canvas can imperatively settle the Konva node there (incl.
  // reverting it to the pickup spot when the drop is rejected).
  const handleObjectDragEnd = useCallback(
    (objectId: number, rawX: number, rawY: number): { x: number; y: number } | undefined => {
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return undefined;
      const w = parseFloat(prevObj.width);
      const h = parseFloat(prevObj.height);

      // Doors/windows slide only along their wall (no grid snap, no boundary
      // clamp — that would yank them off the wall and into the room).
      if (isWallMountedType(prevObj.object_type)) {
        const c = constrainWallObjectMove(prevObj, rawX, rawY, objects);
        const fx = c ? c.x : rawX;
        const fy = c ? c.y : rawY;
        handleObjectMove(objectId, fx, fy);
        return { x: fx, y: fy };
      }

      // Snap to grid (if enabled) → align to adjacent objects → clamp to room.
      const { x: sx, y: sy } = snapEnabled
        ? snapObjectToGrid(rawX, rawY, gridSize)
        : { x: rawX, y: rawY };
      const { x: ax, y: ay } = snapToNeighbors(sx, sy, w, h, objects, objectId);
      const clamped = clampObjectToBoundary(ax, ay, w, h);

      // Overlap: push aside for a single object, revert for 2+ (or unresolvable).
      const rot = parseFloat(prevObj.rotation) || 0;
      const drop = resolveDrop(
        clamped.x,
        clamped.y,
        w,
        h,
        rot,
        objects,
        objectId,
        prevObj.object_type
      );
      if (drop.reverted) {
        return { x: parseFloat(prevObj.x), y: parseFloat(prevObj.y) };
      }
      const { x, y } = clampObjectToBoundary(drop.x, drop.y, w, h);

      // Walls carry their mounted doors/windows; everything else moves alone.
      if (prevObj.object_type === "wall") {
        moveWallAndOpenings(prevObj, x, y);
      } else {
        handleObjectMove(objectId, x, y);
      }
      return { x, y };
    },
    [objects, snapEnabled, gridSize, handleObjectMove, moveWallAndOpenings]
  );

  // ─── Single-object transform persistence (optimistic + rollback) ──────────
  const persistTransform = useCallback(
    async (
      id: number,
      patch: ReturnType<typeof buildTransformPatch>,
      prev: Pick<LayoutObject, "x" | "y" | "width" | "height" | "rotation">
    ) => {
      if (savingObjectIds.has(id)) return;
      updateObjectLocally(id, patch);
      setSaving(id, true);
      setLayoutSaveError(undefined);
      try {
        await updateLayoutObject(officeId, floorId, id, patch);
        flashSaved(id);
      } catch (err) {
        updateObjectLocally(id, prev);
        setLayoutSaveError(buildMoveError(err));
      } finally {
        setSaving(id, false);
      }
    },
    [officeId, floorId, savingObjectIds, updateObjectLocally, setSaving, flashSaved]
  );

  // ─── Transform PATCH — applies snap + clamp then persists ─────────────────
  const handleObjectTransform = useCallback(
    async (
      objectId: number,
      rawX: number,
      rawY: number,
      rawWidth: number,
      rawHeight: number,
      rawRotation: number
    ) => {
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

      const prevSnapshot = {
        x: prevObj.x,
        y: prevObj.y,
        width: prevObj.width,
        height: prevObj.height,
        rotation: prevObj.rotation,
      };

      // A door/window resizes only its LENGTH along the wall: thickness and
      // rotation stay locked to the wall, and it cannot exceed the wall or run
      // over a neighbouring opening.
      if (isWallMountedType(prevObj.object_type)) {
        const oldCx = parseFloat(prevObj.x) + parseFloat(prevObj.width) / 2;
        const oldCy = parseFloat(prevObj.y) + parseFloat(prevObj.height) / 2;
        const host = nearestWall(getSnapWalls(objects), oldCx, oldCy);
        const patch = host
          ? (() => {
              const r = resizeOpeningOnWall(
                prevObj,
                host,
                { x: rawX + rawWidth / 2, y: rawY + rawHeight / 2 },
                rawWidth,
                objects
              );
              return buildTransformPatch(r.x, r.y, r.width, r.height, r.rotation);
            })()
          : buildTransformPatch(rawX, rawY, rawWidth, rawHeight, rawRotation);
        persistTransform(objectId, patch, prevSnapshot);
        return;
      }

      // Snap size, then position; then clamp both to canvas
      let w = rawWidth;
      let h = rawHeight;
      let x = rawX;
      let y = rawY;
      if (snapEnabled) {
        const snappedSize = snapSizeToGrid(w, h, gridSize);
        w = snappedSize.width;
        h = snappedSize.height;
        x = snapToGrid(x, gridSize);
        y = snapToGrid(y, gridSize);
      }
      // Doors/windows already returned above; regular objects clamp to the room.
      const { x: fx, y: fy, width: fw, height: fh } = clampObjectTransformToBoundary(x, y, w, h);
      // Rotation always snaps to a multiple of 10° (86 → 90, 82 → 80).
      const rot = snapRotation(rawRotation);

      // A wall and its mounted doors/windows resize/rotate as one entity: scale
      // each opening through the wall's transform before persisting them.
      if (prevObj.object_type === "wall") {
        const newWall = { x: fx, y: fy, width: fw, height: fh, rotation: rot };
        for (const op of attachedOpenings(prevObj, objects)) {
          const t = transformOpeningWithWall(prevObj, op, newWall);
          persistTransform(op.id, buildTransformPatch(t.x, t.y, t.width, t.height, t.rotation), {
            x: op.x,
            y: op.y,
            width: op.width,
            height: op.height,
            rotation: op.rotation,
          });
        }
      }

      persistTransform(objectId, buildTransformPatch(fx, fy, fw, fh, rot), prevSnapshot);
    },
    [objects, snapEnabled, gridSize, persistTransform]
  );

  // ─── Keyboard handler — axis-specific snap + clamp ────────────────────────
  //
  // e.repeat is ignored to prevent PATCH flooding (Option A from spec).
  // When snap is enabled the step equals gridSize so one keypress = one grid cell.
  // Snap is applied only to the axis that moved to avoid jumping the perpendicular axis.
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!selectedObjectId || !canManageLayout) return;
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (!isArrow) return;
      if (e.repeat) return;
      e.preventDefault();

      const obj = objects.find((o) => o.id === selectedObjectId);
      if (!obj) return;
      const w = parseFloat(obj.width);
      const h = parseFloat(obj.height);

      const step = snapEnabled ? gridSize : e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

      let rawX = parseFloat(obj.x) + dx;
      let rawY = parseFloat(obj.y) + dy;

      // Snap only the axis that moved — avoids the stationary axis jumping to the grid
      if (snapEnabled) {
        if (dx !== 0) rawX = snapToGrid(rawX, gridSize);
        if (dy !== 0) rawY = snapToGrid(rawY, gridSize);
      }

      // Doors/windows slide along their wall instead of clamping to the room.
      if (isWallMountedType(obj.object_type)) {
        const c = constrainWallObjectMove(obj, rawX, rawY, objects);
        if (c) handleObjectMove(selectedObjectId, c.x, c.y);
        return;
      }

      const { x, y } = clampObjectToBoundary(rawX, rawY, w, h);
      // Block the move if it would overlap another object.
      const rot = parseFloat(obj.rotation) || 0;
      if (overlapsBlockingObject(x, y, w, h, rot, objects, selectedObjectId, obj.object_type)) {
        return;
      }
      if (obj.object_type === "wall") {
        moveWallAndOpenings(obj, x, y);
      } else {
        handleObjectMove(selectedObjectId, x, y);
      }
    },
    [
      selectedObjectId,
      canManageLayout,
      objects,
      handleObjectMove,
      moveWallAndOpenings,
      snapEnabled,
      gridSize,
    ]
  );

  return {
    handleObjectMove,
    handleObjectDragEnd,
    handleObjectTransform,
    handleCanvasKeyDown,
    layoutSaveError,
    setLayoutSaveError,
    savedObjectId,
  };
}
