/** Meeting-room DTOs — mirror the Slice 1 serializers (PR 073). */

export type MeetingRoomStatus = "available" | "unavailable" | "maintenance";

export interface MeetingRoom {
  id: number;
  organization: number;
  office: number;
  floor: number;
  layout_object: number;
  layout_object_type: string;
  layout_object_label: string;
  name: string;
  capacity: number;
  status: MeetingRoomStatus;
  status_display: string;
  amenities: Record<string, unknown>;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RoomBookingStatus = "active" | "cancelled";

export interface RoomBooking {
  id: number;
  organization: number;
  office: number;
  office_name?: string;
  floor: number;
  floor_name?: string;
  room: number;
  room_name: string;
  room_capacity: number;
  layout_object: number;
  // Masked for non-owners/non-managers: `user` is absent and `user_name` is
  // "Reserved". Never reconstruct an identity the API did not return.
  user?: number | null;
  user_name: string;
  is_mine: boolean;
  booking_date: string;
  // UTC instants (ISO 8601). Render in office-local time via the office timezone.
  start_at: string;
  end_at: string;
  status: RoomBookingStatus;
  status_display: string;
  cancelled_at: string | null;
  cancelled_by?: number | null;
  created_at: string;
  updated_at: string;
}

/** Create payload — office-local date + wall-clock times (backend converts to UTC). */
export interface CreateRoomBookingPayload {
  room: number;
  booking_date: string;
  start: string; // "HH:MM" office-local
  end: string; // "HH:MM" office-local
}

export type CancelRoomBookingResponse = RoomBooking;

export type MyRoomBookingStatusFilter = "active" | "cancelled" | "all";

export interface MyRoomBookingQueryParams {
  from?: string;
  to?: string;
  status?: MyRoomBookingStatusFilter;
}
