import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type {
  CancelDeskBookingResponse,
  CreateDeskBookingPayload,
  DeskBooking,
  MyBookingQueryParams,
} from "../types/booking.types";

function baseUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/bookings/`;
}

function detailUrl(officeId: number, floorId: number, bookingId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/bookings/${bookingId}/`;
}

/**
 * TD-044: booking lifecycle mutations change availability everywhere a booking
 * is visible. Invalidate the whole `deskBookings:` and `myBookings:` namespaces
 * (broad-but-safe) so no stale reserved/available status survives a book/cancel.
 * Keyed namespaces are cheap to clear and the next mount refetches.
 */
export function invalidateBookingCaches(): void {
  invalidateCache("deskBookings:");
  invalidateCache("myBookings:");
}

export function listFloorBookings(
  officeId: number,
  floorId: number,
  date: string
): Promise<DeskBooking[]> {
  const params = new URLSearchParams({ date });
  return api.get<DeskBooking[]>(`${baseUrl(officeId, floorId)}?${params.toString()}`);
}

export async function createDeskBooking(
  officeId: number,
  floorId: number,
  payload: CreateDeskBookingPayload
): Promise<DeskBooking> {
  const booking = await api.post<DeskBooking>(baseUrl(officeId, floorId), payload);
  invalidateBookingCaches();
  return booking;
}

export async function cancelDeskBooking(
  officeId: number,
  floorId: number,
  bookingId: number
): Promise<CancelDeskBookingResponse> {
  const response = await api.post<CancelDeskBookingResponse>(
    detailUrl(officeId, floorId, bookingId) + "cancel/",
    {}
  );
  invalidateBookingCaches();
  return response;
}

export function getDeskBooking(
  officeId: number,
  floorId: number,
  bookingId: number
): Promise<DeskBooking> {
  return api.get<DeskBooking>(detailUrl(officeId, floorId, bookingId));
}

export function listMyBookings(params?: MyBookingQueryParams): Promise<DeskBooking[]> {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return api.get<DeskBooking[]>(`/api/bookings/my/${qs ? "?" + qs : ""}`);
}

export async function cancelMyBooking(bookingId: number): Promise<DeskBooking> {
  const booking = await api.post<DeskBooking>(`/api/bookings/my/${bookingId}/cancel/`, {});
  invalidateBookingCaches();
  return booking;
}
