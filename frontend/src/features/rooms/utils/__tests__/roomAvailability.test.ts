import { describe, it, expect } from "vitest";
import type { MeetingRoom, RoomBooking } from "../../types/room.types";
import {
  buildRoomAvailabilityByLayoutObjectId,
  findRoomIdByLayoutObjectId,
  roomSlotStatus,
} from "../roomAvailability";

function room(overrides: Partial<MeetingRoom> = {}): MeetingRoom {
  return {
    id: 1,
    organization: 1,
    office: 1,
    floor: 1,
    layout_object: 11,
    layout_object_type: "meeting_room",
    layout_object_label: "MR",
    name: "Room A",
    capacity: 6,
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function rb(overrides: Partial<RoomBooking> = {}): RoomBooking {
  return {
    id: 1,
    organization: 1,
    office: 1,
    floor: 1,
    room: 1,
    room_name: "Room A",
    room_capacity: 6,
    office_timezone: "UTC",
    layout_object: 11,
    user_name: "Reserved",
    is_mine: false,
    booking_date: "2026-06-15",
    start_at: "2026-06-15T09:00:00Z",
    end_at: "2026-06-15T10:00:00Z",
    status: "active",
    status_display: "Active",
    cancelled_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// Slot 09:00–10:00 in UTC = 540–600.
describe("roomSlotStatus", () => {
  it("is available with no overlapping bookings", () => {
    expect(roomSlotStatus([], "UTC", 540, 600)).toBe("available");
    expect(
      roomSlotStatus(
        [rb({ start_at: "2026-06-15T10:00:00Z", end_at: "2026-06-15T11:00:00Z" })],
        "UTC",
        540,
        600
      )
    ).toBe("available"); // back-to-back
  });

  it("is reserved when another user's booking overlaps", () => {
    expect(roomSlotStatus([rb({ is_mine: false })], "UTC", 570, 585)).toBe("reserved");
  });

  it("is bookedByMe when my booking overlaps", () => {
    expect(roomSlotStatus([rb({ is_mine: true })], "UTC", 570, 585)).toBe("bookedByMe");
  });

  it("mine wins over reserved when both overlap the slot", () => {
    const status = roomSlotStatus(
      [rb({ id: 1, is_mine: false }), rb({ id: 2, is_mine: true })],
      "UTC",
      570,
      585
    );
    expect(status).toBe("bookedByMe");
  });

  it("ignores cancelled bookings", () => {
    expect(roomSlotStatus([rb({ status: "cancelled" })], "UTC", 570, 585)).toBe("available");
  });
});

describe("buildRoomAvailabilityByLayoutObjectId", () => {
  it("maps each active room's layout object to its slot status", () => {
    const rooms = [
      room({ id: 1, layout_object: 11 }),
      room({ id: 2, layout_object: 22 }),
      room({ id: 3, layout_object: 33 }),
    ];
    const bookings = [
      rb({ id: 100, room: 1, is_mine: false }), // reserved
      rb({ id: 101, room: 2, is_mine: true }), // bookedByMe
      // room 3 has nothing → available
    ];
    const map = buildRoomAvailabilityByLayoutObjectId(rooms, bookings, "UTC", 570, 585);
    expect(map.get(11)).toBe("reserved");
    expect(map.get(22)).toBe("bookedByMe");
    expect(map.get(33)).toBe("available");
  });

  it("marks a maintenance/unavailable room as unavailable and skips inactive rooms", () => {
    const rooms = [
      room({ id: 1, layout_object: 11, status: "maintenance" }),
      room({ id: 2, layout_object: 22, is_active: false }),
    ];
    const map = buildRoomAvailabilityByLayoutObjectId(rooms, [], "UTC", 540, 600);
    expect(map.get(11)).toBe("unavailable");
    expect(map.has(22)).toBe(false); // inactive room excluded
  });
});

describe("findRoomIdByLayoutObjectId", () => {
  it("finds the room owning a layout object, or null", () => {
    const rooms = [room({ id: 7, layout_object: 70 })];
    expect(findRoomIdByLayoutObjectId(rooms, 70)).toBe(7);
    expect(findRoomIdByLayoutObjectId(rooms, 999)).toBeNull();
  });
});
