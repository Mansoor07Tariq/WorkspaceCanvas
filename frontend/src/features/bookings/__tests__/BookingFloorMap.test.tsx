import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DeskAvailabilityItem } from "../utils/bookingAvailability";
import type { Desk } from "@/features/desks/types/desk.types";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";

// Mock FloorMapCanvas to avoid pulling in Konva and to expose booking-mode behaviour.
// Mirrors real behaviour: buttons only render for objects present in BOTH the `objects`
// array AND the `availabilityByLayoutObjectId` map.
vi.mock("@/features/layoutObjects/components/FloorMapCanvas", () => ({
  FloorMapCanvas: ({
    mode,
    objects,
    availabilityByLayoutObjectId,
    selectedAvailabilityLayoutObjectId,
    onAvailabilityObjectSelect,
  }: {
    mode?: string;
    objects?: { id: number }[];
    availabilityByLayoutObjectId?: Map<number, string>;
    selectedAvailabilityLayoutObjectId?: number | null;
    onAvailabilityObjectSelect?: (id: number) => void;
  }) => (
    <div data-testid="floor-map-canvas" data-mode={mode}>
      {objects &&
        availabilityByLayoutObjectId &&
        objects
          .filter((obj) => availabilityByLayoutObjectId.has(obj.id))
          .map((obj) => {
            const status = availabilityByLayoutObjectId.get(obj.id);
            return (
              <button
                key={obj.id}
                data-testid={`map-object-${obj.id}`}
                data-status={status}
                data-selected={selectedAvailabilityLayoutObjectId === obj.id ? "true" : "false"}
                onClick={() => onAvailabilityObjectSelect?.(obj.id)}
              >
                {status}
              </button>
            );
          })}
    </div>
  ),
}));

import { BookingFloorMap } from "../components/BookingFloorMap";

function makeDesk(id: number, layoutObjectId: number): Desk {
  return {
    id,
    organization: 1,
    office: 1,
    floor: 1,
    layout_object: layoutObjectId,
    layout_object_type: "desk",
    layout_object_label: `Desk ${id}`,
    name: `Desk ${id}`,
    code: `D${id}`,
    status: "available",
    status_display: "Available",
    amenities: {},
    notes: "",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeLayoutObject(id: number): LayoutObject {
  return {
    id,
    floor: 1,
    object_type: "desk",
    object_type_display: "Desk",
    label: `Desk ${id}`,
    x: "100",
    y: "100",
    width: "80",
    height: "60",
    rotation: "0",
    is_bookable: true,
    metadata: {},
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeItem(
  deskId: number,
  layoutObjectId: number,
  status: DeskAvailabilityItem["status"]
): DeskAvailabilityItem {
  return {
    desk: makeDesk(deskId, layoutObjectId),
    layoutObject: makeLayoutObject(layoutObjectId),
    booking: null,
    status,
    isMine: status === "bookedByMe",
    label: status,
  };
}

describe("BookingFloorMap", () => {
  it("renders the floor map canvas in booking mode", async () => {
    render(
      <BookingFloorMap items={[]} layoutObjects={[]} selectedDeskId={null} onDeskSelect={vi.fn()} />
    );
    // findBy waits for the Suspense boundary to resolve (lazy FloorMapCanvas)
    const canvas = await screen.findByTestId("floor-map-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("data-mode", "booking");
  });

  it("renders the map legend", async () => {
    render(
      <BookingFloorMap items={[]} layoutObjects={[]} selectedDeskId={null} onDeskSelect={vi.fn()} />
    );
    // Legend renders synchronously (not lazy-loaded)
    expect(screen.getByRole("list", { name: /map legend/i })).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Your booking")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("passes availability status for each desk layout object", async () => {
    const items = [
      makeItem(1, 10, "available"),
      makeItem(2, 20, "reserved"),
      makeItem(3, 30, "bookedByMe"),
    ];
    render(
      <BookingFloorMap
        items={items}
        layoutObjects={[makeLayoutObject(10), makeLayoutObject(20), makeLayoutObject(30)]}
        selectedDeskId={null}
        onDeskSelect={vi.fn()}
      />
    );
    expect(await screen.findByTestId("map-object-10")).toHaveAttribute("data-status", "available");
    expect(screen.getByTestId("map-object-20")).toHaveAttribute("data-status", "reserved");
    expect(screen.getByTestId("map-object-30")).toHaveAttribute("data-status", "bookedByMe");
  });

  it("marks the selected desk layout object as selected", async () => {
    const items = [makeItem(1, 10, "available"), makeItem(2, 20, "reserved")];
    render(
      <BookingFloorMap
        items={items}
        layoutObjects={[makeLayoutObject(10), makeLayoutObject(20)]}
        selectedDeskId={1}
        onDeskSelect={vi.fn()}
      />
    );
    expect(await screen.findByTestId("map-object-10")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("map-object-20")).toHaveAttribute("data-selected", "false");
  });

  it("clicking a map object calls onDeskSelect with the corresponding desk id", async () => {
    const onDeskSelect = vi.fn();
    const items = [makeItem(5, 50, "available")];
    render(
      <BookingFloorMap
        items={items}
        layoutObjects={[makeLayoutObject(50)]}
        selectedDeskId={null}
        onDeskSelect={onDeskSelect}
      />
    );
    fireEvent.click(await screen.findByTestId("map-object-50"));
    expect(onDeskSelect).toHaveBeenCalledWith(5);
  });

  it("reserved desk object does not expose other user name in rendered output", () => {
    const reservedItem: DeskAvailabilityItem = {
      desk: makeDesk(2, 20),
      layoutObject: makeLayoutObject(20),
      booking: null, // privacy: booking stripped for reserved desks in buildDeskAvailability
      status: "reserved",
      isMine: false,
      label: "Reserved",
    };
    const { container } = render(
      <BookingFloorMap
        items={[reservedItem]}
        layoutObjects={[makeLayoutObject(20)]}
        selectedDeskId={null}
        onDeskSelect={vi.fn()}
      />
    );
    expect(container.textContent).not.toContain("Jane Smith");
    expect(container.textContent).not.toContain("user_name");
  });

  it("renders nothing in the map when no layout objects are provided", () => {
    const items = [makeItem(1, 10, "available")];
    render(
      <BookingFloorMap
        items={items}
        layoutObjects={[]}
        selectedDeskId={null}
        onDeskSelect={vi.fn()}
      />
    );
    expect(screen.queryByTestId("map-object-10")).not.toBeInTheDocument();
  });
});
