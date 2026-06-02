import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/api/apiClient";
import { updateLayoutObject } from "../api/layoutObjectApi";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  buildMovePatch,
  buildTransformPatch,
  clampObjectPosition,
  clampObjectTransform,
  snapToGrid,
  snapObjectToGrid,
  snapSizeToGrid,
} from "../utils/coordinateHelpers";
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
  handleObjectDragEnd: (objectId: number, rawX: number, rawY: number) => void;
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

  // ─── Drag-end wrapper — applies snap (both axes) then clamp ───────────────
  const handleObjectDragEnd = useCallback(
    (objectId: number, rawX: number, rawY: number) => {
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;
      const w = parseFloat(prevObj.width);
      const h = parseFloat(prevObj.height);

      // Snap first, then clamp so the final position is always inside canvas
      const { x: sx, y: sy } = snapEnabled
        ? snapObjectToGrid(rawX, rawY, gridSize)
        : { x: rawX, y: rawY };
      const { x, y } = clampObjectPosition(sx, sy, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);

      handleObjectMove(objectId, x, y);
    },
    [objects, snapEnabled, gridSize, handleObjectMove]
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
      if (savingObjectIds.has(objectId)) return;
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;

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
      const {
        x: fx,
        y: fy,
        width: fw,
        height: fh,
      } = clampObjectTransform(x, y, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);

      const patch = buildTransformPatch(fx, fy, fw, fh, rawRotation);
      updateObjectLocally(objectId, patch);
      setSaving(objectId, true);
      setLayoutSaveError(undefined);

      try {
        await updateLayoutObject(officeId, floorId, objectId, patch);
        flashSaved(objectId);
      } catch (err) {
        updateObjectLocally(objectId, {
          x: prevObj.x,
          y: prevObj.y,
          width: prevObj.width,
          height: prevObj.height,
          rotation: prevObj.rotation,
        });
        setLayoutSaveError(buildMoveError(err));
      } finally {
        setSaving(objectId, false);
      }
    },
    [
      officeId,
      floorId,
      objects,
      savingObjectIds,
      updateObjectLocally,
      setSaving,
      snapEnabled,
      gridSize,
      flashSaved,
    ]
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

      const { x, y } = clampObjectPosition(rawX, rawY, w, h, CANVAS_WIDTH, CANVAS_HEIGHT);
      handleObjectMove(selectedObjectId, x, y);
    },
    [selectedObjectId, canManageLayout, objects, handleObjectMove, snapEnabled, gridSize]
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
