import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { FloorOverviewMap } from "../FloorOverviewMap";
import type { Occupant } from "../FloorOverviewMap";
import type { DeskAvailabilityItem } from "@/features/bookings/utils/bookingAvailability";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";

function lo(id: number, type: string, label: string, x: number, y: number): LayoutObject {
  return {
    id,
    object_type: type,
    label,
    x: String(x),
    y: String(y),
    width: "80",
    height: "50",
    rotation: "0",
  } as never;
}

function item(
  loObj: LayoutObject,
  deskId: number,
  status: string,
  isMine = false
): DeskAvailabilityItem {
  return {
    desk: { id: deskId } as never,
    layoutObject: loObj,
    booking: null,
    status: status as never,
    isMine,
    label: "",
  };
}

const desk1 = lo(101, "desk", "", 100, 100);
const desk2 = lo(102, "desk", "", 220, 100);
const room = lo(201, "room", "Meeting Room", 100, 180);
const layoutObjects = [desk1, desk2, room];
const items = [item(desk1, 1, "bookedByMe", true), item(desk2, 2, "reserved")];
const occupants = new Map<number, Occupant>([[2, { name: "Sarah Kelly", colorKey: 2 }]]);

function renderMap(props: Partial<React.ComponentProps<typeof FloorOverviewMap>> = {}) {
  return render(
    <FloorOverviewMap
      items={items}
      layoutObjects={layoutObjects}
      occupantByDeskId={occupants}
      {...props}
    />
  );
}

describe("FloorOverviewMap — state colouring + labels", () => {
  it("renders a pure SVG (no canvas) with a computed fit scale", () => {
    const { container } = renderMap();
    const svg = screen.getByTestId("floor-overview-svg");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(Number(svg.getAttribute("data-scale"))).toBeGreaterThan(0);
    // no <canvas> anywhere (not the Konva booking canvas)
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("colours desks by status and marks your booking with 'You'", () => {
    const { container } = renderMap();
    expect(container.querySelector('[data-desk-id="1"]')?.getAttribute("data-status")).toBe(
      "bookedByMe"
    );
    expect(container.querySelector('[data-desk-id="2"]')?.getAttribute("data-status")).toBe(
      "reserved"
    );
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("shows the occupant's initials on an occupied desk", () => {
    renderMap();
    expect(screen.getByText("SK")).toBeInTheDocument(); // Sarah Kelly
  });

  it("labels a room/pod with its real name (mist object, not a type code)", () => {
    renderMap();
    expect(screen.getByText("Meeting Room")).toBeInTheDocument();
  });

  it("calls onDeskSelect with the desk id when a desk is clicked", () => {
    const onDeskSelect = vi.fn();
    const { container } = renderMap({ onDeskSelect });
    fireEvent.click(container.querySelector('[data-desk-id="2"]')!);
    expect(onDeskSelect).toHaveBeenCalledWith(2);
  });

  it("clicking the background books (not a specific desk)", () => {
    const onBackgroundClick = vi.fn();
    renderMap({ onBackgroundClick });
    fireEvent.click(screen.getByRole("button"));
    expect(onBackgroundClick).toHaveBeenCalled();
  });
});
