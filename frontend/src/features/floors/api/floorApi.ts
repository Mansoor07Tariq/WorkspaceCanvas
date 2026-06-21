import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type { CreateFloorPayload, Floor, UpdateFloorPayload } from "../types/floor.types";

export function listFloors(officeId: number): Promise<Floor[]> {
  return api.get<Floor[]>(`/api/offices/${officeId}/floors/`);
}

export async function createFloor(officeId: number, data: CreateFloorPayload): Promise<Floor> {
  const floor = await api.post<Floor, CreateFloorPayload>(`/api/offices/${officeId}/floors/`, data);
  // New floor changes the office's floor list and the org-wide summary.
  invalidateCache(`floors:${officeId}`);
  invalidateCache("summary:");
  return floor;
}

export async function updateFloor(
  officeId: number,
  floorId: number,
  data: UpdateFloorPayload
): Promise<Floor> {
  const floor = await api.patch<Floor, UpdateFloorPayload>(
    `/api/offices/${officeId}/floors/${floorId}/`,
    data
  );
  // The floor list (cached per office) now holds stale boundary dimensions.
  invalidateCache(`floors:${officeId}`);
  return floor;
}
