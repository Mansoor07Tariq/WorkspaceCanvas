import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import type { Desk } from "../types/desk.types";

vi.mock("../api/deskApi");
import { createDesk, deleteDesk } from "../api/deskApi";

const mockCreateDesk = vi.mocked(createDesk);
const mockDeleteDesk = vi.mocked(deleteDesk);

import { DeskResourcePanel } from "../components/DeskResourcePanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeDesk(overrides: Partial<Desk> = {}): Desk {
  return {
    id: 1,
    organization: 1,
    office: 2,
    floor: 3,
    layout_object: 10,
    layout_object_type: "desk",
    layout_object_label: "Desk A1",
    name: "Desk A1",
    code: "A1",
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

const defaultProps = {
  officeId: 2,
  floorId: 3,
  canManageLayout: true,
  onDeskCreated: vi.fn(),
  onDeskDeleted: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DeskResourcePanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when no object is selected", () => {
    const { container } = render(
      <DeskResourcePanel {...defaultProps} selectedObject={null} desks={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows not-capable message for non-desk object types", () => {
    const obj = makeLayoutObject({ object_type: "plant", object_type_display: "Plant" });
    render(<DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[]} />);
    expect(screen.getByTestId("desk-not-capable-message")).toBeInTheDocument();
  });

  it("shows not-capable for 'wall' type", () => {
    const obj = makeLayoutObject({ object_type: "wall", object_type_display: "Wall" });
    render(<DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[]} />);
    expect(screen.getByTestId("desk-not-capable-message")).toBeInTheDocument();
  });

  it("shows create form for owner/admin when desk-capable object has no desk", () => {
    const obj = makeLayoutObject();
    render(
      <DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[]} canManageLayout={true} />
    );
    expect(screen.getByTestId("desk-create-form")).toBeInTheDocument();
  });

  it("shows 'not yet bookable' message for member when desk-capable object has no desk", () => {
    const obj = makeLayoutObject();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[]}
        canManageLayout={false}
      />
    );
    expect(screen.getByTestId("desk-no-desk-message")).toBeInTheDocument();
    expect(screen.queryByTestId("desk-create-form")).not.toBeInTheDocument();
  });

  it("shows desk details when a linked desk exists", () => {
    const obj = makeLayoutObject();
    const desk = makeDesk({ name: "Desk Alpha", code: "α1" });
    render(<DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[desk]} />);
    expect(screen.getByText("Desk Alpha")).toBeInTheDocument();
  });

  it("shows deactivate button for owners when desk exists", () => {
    const obj = makeLayoutObject();
    const desk = makeDesk();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[desk]}
        canManageLayout={true}
      />
    );
    expect(screen.getByTestId("desk-deactivate-button")).toBeInTheDocument();
  });

  it("hides deactivate button for members", () => {
    const obj = makeLayoutObject();
    const desk = makeDesk();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[desk]}
        canManageLayout={false}
      />
    );
    expect(screen.queryByTestId("desk-deactivate-button")).not.toBeInTheDocument();
  });

  it("successful desk creation calls onDeskCreated", async () => {
    mockCreateDesk.mockResolvedValue(makeDesk());
    const onDeskCreated = vi.fn();
    const obj = makeLayoutObject();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[]}
        onDeskCreated={onDeskCreated}
        canManageLayout={true}
      />
    );
    // Find by accessible label (MUI TextField renders label association)
    fireEvent.change(screen.getByRole("textbox", { name: /desk name/i }), {
      target: { value: "New Desk" },
    });
    fireEvent.click(screen.getByTestId("desk-create-submit"));
    await waitFor(() => expect(onDeskCreated).toHaveBeenCalled());
  });

  it("failed desk creation shows error message", async () => {
    mockCreateDesk.mockRejectedValue(new Error("Server error"));
    const obj = makeLayoutObject();
    render(
      <DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[]} canManageLayout={true} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: /desk name/i }), {
      target: { value: "Bad Desk" },
    });
    fireEvent.click(screen.getByTestId("desk-create-submit"));
    await waitFor(() => expect(screen.getByText(/could not create desk/i)).toBeInTheDocument());
  });

  it("successful deactivation calls onDeskDeleted", async () => {
    mockDeleteDesk.mockResolvedValue(undefined);
    const onDeskDeleted = vi.fn();
    const obj = makeLayoutObject();
    const desk = makeDesk();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[desk]}
        onDeskDeleted={onDeskDeleted}
        canManageLayout={true}
      />
    );
    fireEvent.click(screen.getByTestId("desk-deactivate-button"));
    await waitFor(() => expect(onDeskDeleted).toHaveBeenCalled());
  });

  it("failed deactivation shows error message", async () => {
    mockDeleteDesk.mockRejectedValue(new Error("Server error"));
    const obj = makeLayoutObject();
    const desk = makeDesk();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[desk]}
        canManageLayout={true}
      />
    );
    fireEvent.click(screen.getByTestId("desk-deactivate-button"));
    await waitFor(() => expect(screen.getByText(/could not remove desk/i)).toBeInTheDocument());
  });

  it("shows DeskBadge when object has a linked desk", () => {
    const obj = makeLayoutObject();
    const desk = makeDesk();
    render(<DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[desk]} />);
    expect(screen.getByText(/bookable/i)).toBeInTheDocument();
  });

  it("does not show DeskBadge when no desk linked", () => {
    const obj = makeLayoutObject();
    render(
      <DeskResourcePanel
        {...defaultProps}
        selectedObject={obj}
        desks={[]}
        canManageLayout={false}
      />
    );
    // The "not capable" message has no badge; in this test object IS capable but no desk
    // so we check the no-desk state has no badge
    expect(screen.queryByText(/^bookable$/i)).not.toBeInTheDocument();
  });

  it("form default name updates when switching to a different desk-capable object", () => {
    const objA = makeLayoutObject({ id: 10, label: "Desk A" });
    const { unmount } = render(
      <DeskResourcePanel {...defaultProps} selectedObject={objA} desks={[]} />
    );
    expect(screen.getByRole("textbox", { name: /desk name/i })).toHaveValue("Desk A");
    unmount();

    const objB = makeLayoutObject({ id: 11, label: "Desk B" });
    render(<DeskResourcePanel {...defaultProps} selectedObject={objB} desks={[]} />);
    expect(screen.getByRole("textbox", { name: /desk name/i })).toHaveValue("Desk B");
  });

  it("stale deactivate error disappears when switching to a different object", async () => {
    mockDeleteDesk.mockRejectedValue(new Error("fail"));
    const obj = makeLayoutObject({ id: 10 });
    const desk = makeDesk({ layout_object: 10 });

    const { unmount } = render(
      <DeskResourcePanel {...defaultProps} selectedObject={obj} desks={[desk]} />
    );
    fireEvent.click(screen.getByTestId("desk-deactivate-button"));
    await waitFor(() => expect(screen.getByText(/could not remove desk/i)).toBeInTheDocument());
    unmount();

    const objB = makeLayoutObject({ id: 11 });
    const deskB = makeDesk({ id: 2, layout_object: 11 });
    render(<DeskResourcePanel {...defaultProps} selectedObject={objB} desks={[deskB]} />);
    expect(screen.queryByText(/could not remove desk/i)).not.toBeInTheDocument();
  });

  it("works for all desk-capable types", () => {
    const types = ["desk", "standing_desk", "hot_desk", "private_desk"] as const;
    for (const t of types) {
      const { unmount } = render(
        <DeskResourcePanel
          {...defaultProps}
          selectedObject={makeLayoutObject({ object_type: t })}
          desks={[]}
          canManageLayout={true}
        />
      );
      expect(screen.getByTestId("desk-create-form")).toBeInTheDocument();
      unmount();
    }
  });
});
