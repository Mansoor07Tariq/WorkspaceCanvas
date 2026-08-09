import { describe, it, expect } from "vitest";
import { mergeMyBookings } from "../mergeMyBookings";
import type { DeskBooking } from "../../types/booking.types";
import type { RoomBooking } from "@/features/rooms/types/room.types";

function desk(id: number): DeskBooking {
  return {
    id,
    organization: 1,
    office: 1,
    floor: 1,
    desk: id,
    desk_name: `Desk ${id}`,
    desk_code: "",
    layout_object: id,
    user_name: "Me",
    booking_date: "2026-06-15",
    status: "active",
    status_display: "Active",
    created_at: "",
    updated_at: "",
    cancelled_at: null,
    is_mine: true,
  };
}

function room(id: number): RoomBooking {
  return {
    id,
    organization: 1,
    office: 1,
    floor: 1,
    room: id,
    room_name: `Room ${id}`,
    room_capacity: 6,
    layout_object: id,
    user_name: "Me",
    is_mine: true,
    booking_date: "2026-06-15",
    start_at: "2026-06-15T09:00:00Z",
    end_at: "2026-06-15T10:00:00Z",
    status: "active",
    status_display: "Active",
    cancelled_at: null,
    created_at: "",
    updated_at: "",
  };
}

describe("mergeMyBookings", () => {
  it("tags each booking with its resource_type", () => {
    const merged = mergeMyBookings([desk(1)], [room(2)]);
    const byId = Object.fromEntries(merged.map((b) => [b.id, b.resource_type]));
    expect(byId[1]).toBe("desk");
    expect(byId[2]).toBe("room");
  });

  it("returns the other half when one input is empty (partial failure safe)", () => {
    expect(mergeMyBookings([], [room(2)]).map((b) => b.resource_type)).toEqual(["room"]);
    expect(mergeMyBookings([desk(1)], []).map((b) => b.resource_type)).toEqual(["desk"]);
    expect(mergeMyBookings([], [])).toEqual([]);
  });
});
