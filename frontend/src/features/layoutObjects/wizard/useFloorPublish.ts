/**
 * useFloorPublish — publish / unpublish a floor and drive the edit-confirm
 * dialog (PR 064). Publishing makes desks bookable; editing a published floor
 * unpublishes it (back to draft) after the admin confirms.
 */
import { useCallback, useState } from "react";
import { setFloorStatus } from "@/features/floors/api/floorApi";
import type { Floor } from "@/features/floors/types/floor.types";

interface Params {
  officeId: number;
  floorId: number;
  onChanged: (floor: Floor) => void;
}

export interface UseFloorPublishResult {
  busy: boolean;
  error: string | null;
  confirmEditOpen: boolean;
  publish: () => Promise<void>;
  requestEdit: () => void;
  cancelEdit: () => void;
  confirmEdit: () => Promise<void>;
  clearError: () => void;
}

export function useFloorPublish({ officeId, floorId, onChanged }: Params): UseFloorPublishResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);

  const run = useCallback(
    async (status: "draft" | "published", errKey: string) => {
      setBusy(true);
      setError(null);
      try {
        const floor = await setFloorStatus(officeId, floorId, status);
        onChanged(floor);
        return true;
      } catch {
        setError(errKey);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [officeId, floorId, onChanged]
  );

  const publish = useCallback(async () => {
    await run("published", "publishError");
  }, [run]);

  const requestEdit = useCallback(() => setConfirmEditOpen(true), []);
  const cancelEdit = useCallback(() => setConfirmEditOpen(false), []);
  const confirmEdit = useCallback(async () => {
    const ok = await run("draft", "unpublishError");
    if (ok) setConfirmEditOpen(false);
  }, [run]);

  return {
    busy,
    error,
    confirmEditOpen,
    publish,
    requestEdit,
    cancelEdit,
    confirmEdit,
    clearError: () => setError(null),
  };
}
