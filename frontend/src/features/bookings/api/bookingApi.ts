import { api } from "@/lib/api/apiClient";
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

export function listFloorBookings(
  officeId: number,
  floorId: number,
  date: string
): Promise<DeskBooking[]> {
  const params = new URLSearchParams({ date });
  return api.get<DeskBooking[]>(`${baseUrl(officeId, floorId)}?${params.toString()}`);
}

export function createDeskBooking(
  officeId: number,
  floorId: number,
  payload: CreateDeskBookingPayload
): Promise<DeskBooking> {
  return api.post<DeskBooking>(baseUrl(officeId, floorId), payload);
}

export function cancelDeskBooking(
  officeId: number,
  floorId: number,
  bookingId: number
): Promise<CancelDeskBookingResponse> {
  return api.post<CancelDeskBookingResponse>(
    detailUrl(officeId, floorId, bookingId) + "cancel/",
    {}
  );
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

export function cancelMyBooking(bookingId: number): Promise<DeskBooking> {
  return api.post<DeskBooking>(`/api/bookings/my/${bookingId}/cancel/`, {});
}
