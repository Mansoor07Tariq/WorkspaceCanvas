import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/api/apiClient";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import { updateLayoutObject } from "../api/layoutObjectApi";
import {
  buildMovePatch,
  buildTransformPatch,
  clampObjectToBoundary,
  clampObjectTransformToBoundary,
  formatCoordinate,
  snapToGrid,
  snapObjectToGrid,
  snapSizeToGrid,
  snapRotation,
  snapCutoutToBoundary,
  DEFAULT_FLOOR_BOUNDARY,
  type FloorBoundary,
} from "../utils/coordinateHelpers";
import {
  isWallMountedType,
  constrainWallObjectMove,
  attachedOpenings,
  transformOpeningWithWall,
  resizeOpeningOnWall,
  carryBoundaryOpeningsOnResize,
  nearestWall,
  getSnapWalls,
} from "../utils/wallPlacement";
import { snapToNeighbors, overlapsBlockingObject, resolveDrop } from "../utils/objectSnapping";
import { getCutoutRects, snapCutoutToNeighbors } from "../utils/floorShape";
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
  /** Live floor boundary objects are clamped to. Defaults to the fixed room. */
  boundary?: FloorBoundary;
  /** When true (enhanced view), doors/windows snap to the carved cutout walls. */
  enhanced?: boolean;
}

/**
 * Inspector edit input (label / size / rotation / notes). Structurally matches the
 * inspector's `InspectorPatch` so the page can forward it directly, without the
 * hook depending on a component type.
 */
export interface ObjectDetailsInput {
  label: string;
  width: string;
  height: string;
  rotation: string;
  notes: string;
}

export interface UseCanvasInteractionsResult {
  handleObjectMove: (objectId: number, x: number, y: number) => Promise<void>;
  /**
   * Optimistic inspector-detail save (label/size/rotation/notes) with rollback.
   * The single optimistic-persistence path — previously re-implemented inline in
   * FloorLayoutPage (PR 067). No concurrent-save guard, no "Saved" flash, and it
   * surfaces the raw API error message (unchanged from the old inline version).
   */
  handleObjectDetailsSave: (id: number, patch: ObjectDetailsInput) => Promise<void>;
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
  /** Clamp every object back inside `b` and persist the ones that moved. */
  reflowObjectsIntoBoundary: (b: FloorBoundary) => void;
  /**
   * Apply a room resize to the layout: carry boundary-wall openings onto the new
   * walls and shift the rest of the contents by (shiftX, shiftY) so the room can
   * re-anchor to the fixed inset while growing from the dragged edge.
   */
  applyBoundaryResize: (
    oldBoundary: FloorBoundary,
    newBoundary: FloorBoundary,
    shiftX: number,
    shiftY: number
  ) => void;
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
  boundary = DEFAULT_FLOOR_BOUNDARY,
  enhanced = false,
}: UseCanvasInteractionsParams): UseCanvasInteractionsResult {
  // In the enhanced view the snap walls are the carved cutout walls.
  const snapCutouts = useCallback(
    (objs: LayoutObject[]) => (enhanced ? getCutoutRects(objs) : []),
    [enhanced]
  );
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

  // ─── Single optimistic-persist primitive (PR 067) ─────────────────────────
  // Move, transform, and inspector-detail saves all funnel through here: apply the
  // patch locally, PATCH it, roll back the given `prev` fields on failure, toggle
  // saving. The flags capture the behavioural differences that predate the
  // consolidation — drag/transform guard against a concurrent save, flash the
  // transient "Saved" chip, and use the move/permission error copy; detail saves
  // (previously inline in FloorLayoutPage) do none of those and surface the raw
  // API error.
  const persistObjectPatch = useCallback(
    async (
      id: number,
      patch: Partial<LayoutObject>,
      prev: Partial<LayoutObject>,
      opts: { guard: boolean; flash: boolean; errorFor: (err: unknown) => string }
    ) => {
      if (opts.guard && savingObjectIds.has(id)) return;
      updateObjectLocally(id, patch);
      setSaving(id, true);
      setLayoutSaveError(undefined);
      try {
        await updateLayoutObject(officeId, floorId, id, patch);
        if (opts.flash) flashSaved(id);
      } catch (err) {
        updateObjectLocally(id, prev);
        setLayoutSaveError(opts.errorFor(err));
      } finally {
        setSaving(id, false);
      }
    },
    [officeId, floorId, savingObjectIds, updateObjectLocally, setSaving, flashSaved]
  );

  // ─── Core move PATCH — receives final coordinates (already snapped/clamped) ─
  const handleObjectMove = useCallback(
    async (objectId: number, x: number, y: number) => {
      const prevObj = objects.find((o) => o.id === objectId);
      if (!prevObj) return;
      await persistObjectPatch(
        objectId,
        buildMovePatch(x, y),
        { x: prevObj.x, y: prevObj.y },
        {
          guard: true,
          flash: true,
          errorFor: buildMoveError,
        }
      );
    },
    [objects, persistObjectPatch]
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
        const c = constrainWallObjectMove(
          prevObj,
          rawX,
          rawY,
          objects,
          boundary,
          snapCutouts(objects)
        );
        const fx = c ? c.x : rawX;
        const fy = c ? c.y : rawY;
        handleObjectMove(objectId, fx, fy);
        return { x: fx, y: fy };
      }

      // A cutout carves the office shape, so it stays flush against a wall and
      // abuts neighbouring cutouts (so two side by side merge with no wall
      // between). No furniture-style overlap logic.
      if (prevObj.object_type === "cutout") {
        const others = getCutoutRects(objects.filter((o) => o.id !== objectId));
        const b = snapCutoutToBoundary(rawX, rawY, w, h, boundary);
        const n = snapCutoutToNeighbors(b.x, b.y, w, h, others);
        const final = snapCutoutToBoundary(n.x, n.y, w, h, boundary);
        handleObjectMove(objectId, final.x, final.y);
        return { x: final.x, y: final.y };
      }

      // Snap to grid (if enabled) → align to adjacent objects → clamp to room.
      // All three are rotation-aware (FE-1/FE-4) so a rotated object aligns and
      // stays inside by its true footprint, not its unrotated box.
      const rot = parseFloat(prevObj.rotation) || 0;
      const { x: sx, y: sy } = snapEnabled
        ? snapObjectToGrid(rawX, rawY, gridSize)
        : { x: rawX, y: rawY };
      const { x: ax, y: ay } = snapToNeighbors(sx, sy, w, h, rot, objects, objectId);
      const clamped = clampObjectToBoundary(ax, ay, w, h, boundary, rot);

      // Overlap: push aside for a single object, revert for 2+ (or unresolvable).
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
      const { x, y } = clampObjectToBoundary(drop.x, drop.y, w, h, boundary, rot);

      // Walls carry their mounted doors/windows; everything else moves alone.
      if (prevObj.object_type === "wall") {
        moveWallAndOpenings(prevObj, x, y);
      } else {
        handleObjectMove(objectId, x, y);
      }
      return { x, y };
    },
    [objects, snapEnabled, gridSize, handleObjectMove, moveWallAndOpenings, boundary, snapCutouts]
  );

  // ─── Pull objects back inside the room after the boundary shrinks (PR 061) ──
  // Called on resize-commit: any object now outside the (possibly smaller) room
  // is clamped back in and persisted. Only objects that actually move are saved.
  const reflowObjectsIntoBoundary = useCallback(
    (b: FloorBoundary) => {
      for (const obj of objects) {
        // Doors/windows live on their wall — leave them to the wall's own logic.
        if (isWallMountedType(obj.object_type)) continue;
        const w = parseFloat(obj.width);
        const h = parseFloat(obj.height);
        const x = parseFloat(obj.x);
        const y = parseFloat(obj.y);
        const rot = parseFloat(obj.rotation) || 0;
        const { x: cx, y: cy } = clampObjectToBoundary(x, y, w, h, b, rot);
        if (cx === x && cy === y) continue;
        if (obj.object_type === "wall") moveWallAndOpenings(obj, cx, cy);
        else handleObjectMove(obj.id, cx, cy);
      }
    },
    [objects, handleObjectMove, moveWallAndOpenings]
  );

  // ─── Apply a room resize to the contents (PR 061) ──────────────────────────
  // Two things move when the boundary changes:
  //  • doors/windows on a boundary wall are part of it → re-placed on the new
  //    wall (translate + scale-position) so they keep sitting on it;
  //  • everything else is shifted by (shiftX, shiftY) — the distance the origin
  //    moved when a top/left/corner handle was dragged — so the room can stay
  //    anchored at the fixed inset while visually growing from the dragged edge.
  // With a bottom/right drag (or a numeric edit) the shift is zero, so furniture
  // stays put and only the boundary openings follow the lengthened walls.
  const applyBoundaryResize = useCallback(
    (oldBoundary: FloorBoundary, newBoundary: FloorBoundary, shiftX: number, shiftY: number) => {
      const carries = carryBoundaryOpeningsOnResize(oldBoundary, newBoundary, objects);
      const carried = new Set(carries.map((c) => c.id));
      for (const c of carries) handleObjectMove(c.id, c.x, c.y);

      if (shiftX === 0 && shiftY === 0) return;
      for (const o of objects) {
        if (carried.has(o.id)) continue;
        const nx = parseFloat(o.x) + shiftX;
        const ny = parseFloat(o.y) + shiftY;
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
        // Uniform shift: inner walls and their openings move by the same vector,
        // so they stay together without per-wall carry.
        handleObjectMove(o.id, nx, ny);
      }
    },
    [objects, handleObjectMove]
  );

  // ─── Single-object transform persistence (optimistic + rollback) ──────────
  const persistTransform = useCallback(
    async (
      id: number,
      patch: ReturnType<typeof buildTransformPatch>,
      prev: Pick<LayoutObject, "x" | "y" | "width" | "height" | "rotation">
    ) => {
      await persistObjectPatch(id, patch, prev, {
        guard: true,
        flash: true,
        errorFor: buildMoveError,
      });
    },
    [persistObjectPatch]
  );

  // ─── Inspector detail save (label/size/rotation/notes) — optimistic + rollback
  // The single home for optimistic persistence: this was re-implemented inline in
  // FloorLayoutPage (PR 067). Behaviour is preserved exactly — no concurrent-save
  // guard, no "Saved" flash, raw API error message; notes merge into metadata.
  const handleObjectDetailsSave = useCallback(
    async (id: number, patch: ObjectDetailsInput) => {
      const prev = objects.find((o) => o.id === id);
      if (!prev) return;
      const update = {
        label: patch.label,
        width: formatCoordinate(parseFloat(patch.width)),
        height: formatCoordinate(parseFloat(patch.height)),
        rotation: formatCoordinate(parseFloat(patch.rotation)),
        metadata: { ...prev.metadata, notes: patch.notes },
      };
      await persistObjectPatch(
        id,
        update,
        {
          label: prev.label,
          width: prev.width,
          height: prev.height,
          rotation: prev.rotation,
          metadata: prev.metadata,
        },
        { guard: false, flash: false, errorFor: getApiErrorMessage }
      );
    },
    [objects, persistObjectPatch]
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
        const host = nearestWall(
          getSnapWalls(objects, boundary, snapCutouts(objects)),
          oldCx,
          oldCy
        );
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

      // A cutout resizes freely (no rotation) but stays clamped to the room and
      // re-snapped flush against a wall.
      if (prevObj.object_type === "cutout") {
        const {
          x: cx,
          y: cy,
          width: cw,
          height: ch,
        } = clampObjectTransformToBoundary(rawX, rawY, rawWidth, rawHeight, boundary);
        const snapped = snapCutoutToBoundary(cx, cy, cw, ch, boundary);
        persistTransform(
          objectId,
          buildTransformPatch(snapped.x, snapped.y, cw, ch, 0),
          prevSnapshot
        );
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
      // Rotation always snaps to a multiple of 10° (86 → 90, 82 → 80).
      const rot = snapRotation(rawRotation);
      // Doors/windows already returned above; regular objects clamp to the room by
      // their rotated footprint (FE-1).
      const {
        x: fx,
        y: fy,
        width: fw,
        height: fh,
      } = clampObjectTransformToBoundary(x, y, w, h, boundary, rot);

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
    [objects, snapEnabled, gridSize, persistTransform, boundary, snapCutouts]
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
        const c = constrainWallObjectMove(obj, rawX, rawY, objects, boundary, snapCutouts(objects));
        if (c) handleObjectMove(selectedObjectId, c.x, c.y);
        return;
      }

      // A cutout stays flush against a wall.
      if (obj.object_type === "cutout") {
        const c = snapCutoutToBoundary(rawX, rawY, w, h, boundary);
        handleObjectMove(selectedObjectId, c.x, c.y);
        return;
      }

      const rot = parseFloat(obj.rotation) || 0;
      const { x, y } = clampObjectToBoundary(rawX, rawY, w, h, boundary, rot);
      // Block the move if it would overlap another object.
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
      boundary,
      snapCutouts,
    ]
  );

  return {
    handleObjectMove,
    handleObjectDetailsSave,
    handleObjectDragEnd,
    handleObjectTransform,
    handleCanvasKeyDown,
    reflowObjectsIntoBoundary,
    applyBoundaryResize,
    layoutSaveError,
    setLayoutSaveError,
    savedObjectId,
  };
}
