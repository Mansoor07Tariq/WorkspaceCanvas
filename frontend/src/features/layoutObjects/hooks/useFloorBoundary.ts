import { useCallback, useEffect, useRef, useState } from "react";
import { updateFloor } from "@/features/floors/api/floorApi";
import { getApiErrorMessage } from "@/lib/api/getApiErrorMessage";
import type { Floor } from "@/features/floors/types/floor.types";
import {
  DEFAULT_FLOOR_BOUNDARY,
  makeFloorBoundary,
  type FloorBoundary,
} from "../utils/coordinateHelpers";

/** Debounce (ms) before a resize is persisted to the backend. */
const PERSIST_DELAY_MS = 600;

interface UseFloorBoundaryParams {
  officeId: number;
  floorId: number;
  /** The loaded floor (carries persisted boundary dims). Undefined until loaded. */
  floor: Floor | undefined;
  /** Only owners/admins may persist; members get a read-only (still-rendered) room. */
  canManage: boolean;
  /** Called after a resize settles (debounced) so the page can reflow objects. */
  onResizeSettled?: (boundary: FloorBoundary) => void;
}

interface UseFloorBoundaryResult {
  boundary: FloorBoundary;
  /** Update the room size locally (immediate) and persist it debounced. */
  resizeBoundary: (width: number, height: number) => void;
  /** Last persist error message, or undefined. */
  saveError: string | undefined;
}

/**
 * Owns the editable, per-floor room boundary (PR 061 follow-up). The boundary is
 * seeded once from the loaded floor, updated optimistically on resize, and
 * persisted to the backend debounced. On settle it notifies the page so objects
 * left outside a shrunken room get pulled back in.
 */
export function useFloorBoundary({
  officeId,
  floorId,
  floor,
  canManage,
  onResizeSettled,
}: UseFloorBoundaryParams): UseFloorBoundaryResult {
  const [boundary, setBoundary] = useState<FloorBoundary>(DEFAULT_FLOOR_BOUNDARY);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  // Seed from the server exactly once per floor id. Later local edits must not be
  // clobbered by a re-render with the same (now-stale) server value.
  // (Intentional state-sync-from-async-prop — the canonical use for an effect.)
  const seededFloorId = useRef<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- seeding the room once from the async-loaded floor */
  useEffect(() => {
    if (!floor || floor.id !== floorId) return;
    if (seededFloorId.current === floor.id) return;
    const w = Number(floor.boundary_width);
    const h = Number(floor.boundary_height);
    // Guard against missing/partial floor data: keep the default room rather than
    // seeding a NaN-sized boundary.
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    seededFloorId.current = floor.id;
    setBoundary(makeFloorBoundary(w, h));
  }, [floor, floorId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset the seed guard when navigating to a different floor.
  useEffect(() => {
    seededFloorId.current = null;
  }, [floorId]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resizeBoundary = useCallback(
    (width: number, height: number) => {
      const next = makeFloorBoundary(width, height);
      setBoundary(next);
      if (!canManage) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void updateFloor(officeId, floorId, {
          boundary_width: next.width,
          boundary_height: next.height,
        })
          .then(() => setSaveError(undefined))
          .catch((err) => setSaveError(getApiErrorMessage(err)))
          .finally(() => onResizeSettled?.(next));
      }, PERSIST_DELAY_MS);
    },
    [officeId, floorId, canManage, onResizeSettled]
  );

  return { boundary, resizeBoundary, saveError };
}
