import { api } from "@/lib/api/apiClient";
import type { CreateDeskPayload, Desk, UpdateDeskPayload } from "../types/desk.types";

function baseUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/desks/`;
}

function detailUrl(officeId: number, floorId: number, deskId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/desks/${deskId}/`;
}

export function listDesks(officeId: number, floorId: number): Promise<Desk[]> {
  return api.get<Desk[]>(baseUrl(officeId, floorId));
}

export function createDesk(
  officeId: number,
  floorId: number,
  data: CreateDeskPayload
): Promise<Desk> {
  return api.post<Desk>(baseUrl(officeId, floorId), data);
}

export function updateDesk(
  officeId: number,
  floorId: number,
  deskId: number,
  data: UpdateDeskPayload
): Promise<Desk> {
  return api.patch<Desk>(detailUrl(officeId, floorId, deskId), data);
}

export function deleteDesk(officeId: number, floorId: number, deskId: number): Promise<void> {
  return api.delete<void>(detailUrl(officeId, floorId, deskId));
}
