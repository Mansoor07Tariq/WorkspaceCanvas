import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import { invalidateBookingCaches } from "@/features/bookings/api/bookingApi";
import type { CreateDeskPayload, Desk, UpdateDeskPayload } from "../types/desk.types";

function baseUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/desks/`;
}

function detailUrl(officeId: number, floorId: number, deskId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/desks/${deskId}/`;
}

// Desk changes affect this floor's desk list and the org-wide bookable-desk count.
function invalidateDeskCaches(officeId: number, floorId: number): void {
  invalidateCache(`desks:${officeId}:${floorId}`);
  invalidateCache("summary:");
}

export function listDesks(officeId: number, floorId: number): Promise<Desk[]> {
  return api.get<Desk[]>(baseUrl(officeId, floorId));
}

export function getDesk(officeId: number, floorId: number, deskId: number): Promise<Desk> {
  return api.get<Desk>(detailUrl(officeId, floorId, deskId));
}

export async function createDesk(
  officeId: number,
  floorId: number,
  data: CreateDeskPayload
): Promise<Desk> {
  const desk = await api.post<Desk>(baseUrl(officeId, floorId), data);
  invalidateDeskCaches(officeId, floorId);
  return desk;
}

export async function updateDesk(
  officeId: number,
  floorId: number,
  deskId: number,
  data: UpdateDeskPayload
): Promise<Desk> {
  const desk = await api.patch<Desk>(detailUrl(officeId, floorId, deskId), data);
  invalidateDeskCaches(officeId, floorId);
  // A status change (e.g. → maintenance) changes desk availability in booking views.
  invalidateBookingCaches();
  return desk;
}

export async function deleteDesk(officeId: number, floorId: number, deskId: number): Promise<void> {
  await api.delete<void>(detailUrl(officeId, floorId, deskId));
  invalidateDeskCaches(officeId, floorId);
  // TD-044: deactivating a desk cancels its active bookings on the backend, so
  // any cached booking availability must be dropped.
  invalidateBookingCaches();
}
