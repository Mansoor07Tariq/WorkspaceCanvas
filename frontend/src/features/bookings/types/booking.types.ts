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
  user: number;
  user_name: string;
  booking_date: string;
  status: DeskBookingStatus;
  status_display: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by?: number | null;
  is_mine: boolean;
}

export interface CreateDeskBookingPayload {
  desk: number;
  booking_date: string;
}

export type CancelDeskBookingResponse = DeskBooking;
