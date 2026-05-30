import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { LayoutObject } from "../types/layoutObject.types";
import { LayoutObjectListItem } from "../components/LayoutObjectListItem";

function makeLayoutObject(overrides: Partial<LayoutObject> = {}): LayoutObject {
  return {
    id: 10,
    floor: 3,
    object_type: "desk",
    object_type_display: "Desk",
    label: "Desk A1",
    x: "100.00",
    y: "150.00",
    width: "80.00",
    height: "50.00",
    rotation: "0.00",
    is_bookable: false,
    metadata: {},
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("LayoutObjectListItem — bookable badge", () => {
  it("shows Bookable badge when hasDesk is true", () => {
    render(<LayoutObjectListItem obj={makeLayoutObject()} onDelete={vi.fn()} hasDesk={true} />);
    expect(screen.getByText(/bookable/i)).toBeInTheDocument();
  });

  it("does not show Bookable badge when hasDesk is false", () => {
    render(<LayoutObjectListItem obj={makeLayoutObject()} onDelete={vi.fn()} hasDesk={false} />);
    expect(screen.queryByText(/bookable/i)).not.toBeInTheDocument();
  });

  it("does not show Bookable badge when hasDesk is omitted", () => {
    render(<LayoutObjectListItem obj={makeLayoutObject()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/bookable/i)).not.toBeInTheDocument();
  });
});
