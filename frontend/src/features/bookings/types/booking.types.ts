export type DeskBookingStatus = "active" | "cancelled";

export interface DeskBooking {
  id: number;
  organization: number;
  office: number;
  floor: number;
  desk: number;
  desk_name: string;
  desk_code: string;
  layout_object: number;
  user?: number | null;
  user_name: string;
  /**
   * Occupant photo URL for the desk-identity tile, or null when the user has no photo
   * (UI falls back to coloured initials) or identity is masked for the viewer. Masked
   * server-side by the same same-org rule as `user_name` (PR 080 B3).
   */
  user_avatar?: string | null;
  booking_date: string;
  status: DeskBookingStatus;
  status_display: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by?: number | null;
  is_mine: boolean;
  office_name?: string;
  floor_name?: string;
}

export interface CreateDeskBookingPayload {
  desk: number;
  booking_date: string;
}

export type CancelDeskBookingResponse = DeskBooking;

export type MyBookingStatusFilter = "active" | "cancelled" | "all";

export interface MyBookingQueryParams {
  from?: string;
  to?: string;
  status?: MyBookingStatusFilter;
}
