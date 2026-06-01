import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeskAvailabilityList } from "../components/DeskAvailabilityList";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";
import type { Desk } from "@/features/desks/types/desk.types";

function makeDesk(id: number, name: string, overrides: Partial<Desk> = {}): Desk {
  return {
    id,
    organization: 1,
    office: 1,
    floor: 1,
    layout_object: id + 10,
    layout_object_type: "desk",
    layout_object_label: name,
    name,
    code: "",
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeItem(
  id: number,
  name: string,
  status: DeskAvailabilityItem["status"] = "available"
): DeskAvailabilityItem {
  return {
    desk: makeDesk(id, name),
    layoutObject: null,
    booking: null,
    status,
    isMine: status === "bookedByMe",
    label:
      status === "available"
        ? "Available"
        : status === "reserved"
          ? "Reserved"
          : status === "bookedByMe"
            ? "Your booking"
            : "Unavailable",
  };
}

describe("DeskAvailabilityList", () => {
  it("renders empty state when no items provided", () => {
    render(
      <DeskAvailabilityList
        items={[]}
        selectedDeskId={null}
        onSelectDesk={vi.fn()}
        onBookDesk={vi.fn()}
        onCancelBooking={vi.fn()}
        hasMyBooking={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByText("No desks found for this floor.")).toBeInTheDocument();
  });

  it("renders a card for each item", () => {
    const items = [makeItem(1, "Desk A1"), makeItem(2, "Desk A2"), makeItem(3, "Desk A3")];
    render(
      <DeskAvailabilityList
        items={items}
        selectedDeskId={null}
        onSelectDesk={vi.fn()}
        onBookDesk={vi.fn()}
        onCancelBooking={vi.fn()}
        hasMyBooking={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByText("Desk A1")).toBeInTheDocument();
    expect(screen.getByText("Desk A2")).toBeInTheDocument();
    expect(screen.getByText("Desk A3")).toBeInTheDocument();
  });

  it("renders the region with correct aria-label", () => {
    const items = [makeItem(1, "Desk A1")];
    render(
      <DeskAvailabilityList
        items={items}
        selectedDeskId={null}
        onSelectDesk={vi.fn()}
        onBookDesk={vi.fn()}
        onCancelBooking={vi.fn()}
        hasMyBooking={false}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    expect(screen.getByRole("region", { name: "Desk availability" })).toBeInTheDocument();
  });

  it("sorts bookedByMe desks before available desks", () => {
    const items = [
      makeItem(1, "Desk Available", "available"),
      makeItem(2, "Desk Mine", "bookedByMe"),
    ];
    const { container } = render(
      <DeskAvailabilityList
        items={items}
        selectedDeskId={null}
        onSelectDesk={vi.fn()}
        onBookDesk={vi.fn()}
        onCancelBooking={vi.fn()}
        hasMyBooking={true}
        bookingLoading={false}
        cancelLoading={false}
      />
    );
    const allCards = container.querySelectorAll("[data-testid^='desk-availability-card-']");
    // bookedByMe (id=2) should appear before available (id=1)
    expect(allCards[0]).toHaveAttribute("data-testid", "desk-availability-card-2");
    expect(allCards[1]).toHaveAttribute("data-testid", "desk-availability-card-1");
  });
});
