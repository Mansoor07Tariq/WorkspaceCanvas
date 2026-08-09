import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type {
  CancelRoomBookingResponse,
  CreateRoomBookingPayload,
  MeetingRoom,
  RoomBooking,
} from "../types/room.types";

function roomsUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/rooms/`;
}

function roomBookingsUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/room-bookings/`;
}

/**
 * Mirrors `invalidateBookingCaches` (bookingApi.ts): a room booking create/cancel
 * changes availability wherever that day's bookings are shown, so clear the whole
 * `roomBookings:` namespace (broad-but-safe). Room *resources* (the `rooms:`
 * namespace) don't change on a booking, so they are left cached.
 */
export function invalidateRoomBookingCaches(): void {
  invalidateCache("roomBookings:");
}

export function listMeetingRooms(officeId: number, floorId: number): Promise<MeetingRoom[]> {
  return api.get<MeetingRoom[]>(roomsUrl(officeId, floorId));
}

export function listRoomBookings(
  officeId: number,
  floorId: number,
  date: string
): Promise<RoomBooking[]> {
  const params = new URLSearchParams({ date });
  return api.get<RoomBooking[]>(`${roomBookingsUrl(officeId, floorId)}?${params.toString()}`);
}

export async function createRoomBooking(
  officeId: number,
  floorId: number,
  payload: CreateRoomBookingPayload
): Promise<RoomBooking> {
  const booking = await api.post<RoomBooking>(roomBookingsUrl(officeId, floorId), payload);
  invalidateRoomBookingCaches();
  return booking;
}

export async function cancelRoomBooking(
  officeId: number,
  floorId: number,
  bookingId: number
): Promise<CancelRoomBookingResponse> {
  const response = await api.post<CancelRoomBookingResponse>(
    `${roomBookingsUrl(officeId, floorId)}${bookingId}/cancel/`,
    {}
  );
  invalidateRoomBookingCaches();
  return response;
}
