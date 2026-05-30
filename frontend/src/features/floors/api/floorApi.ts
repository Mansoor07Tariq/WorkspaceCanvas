import { api } from "@/lib/api/apiClient";
import type { CreateFloorPayload, Floor } from "../types/floor.types";

export function listFloors(officeId: number): Promise<Floor[]> {
  return api.get<Floor[]>(`/api/offices/${officeId}/floors/`);
}

export function createFloor(officeId: number, data: CreateFloorPayload): Promise<Floor> {
  return api.post<Floor, CreateFloorPayload>(`/api/offices/${officeId}/floors/`, data);
}
