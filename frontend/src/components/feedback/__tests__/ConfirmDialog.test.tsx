import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "../ConfirmDialog";

function setup(over: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Cancel this booking?"
      message="This releases the desk for others."
      confirmLabel="Cancel booking"
      cancelLabel="Keep booking"
      onConfirm={onConfirm}
      onClose={onClose}
      {...over}
    />
  );
  return { onConfirm, onClose };
}

describe("ConfirmDialog", () => {
  it("renders the title, message, and both buttons when open", () => {
    setup();
    expect(screen.getByText("Cancel this booking?")).toBeInTheDocument();
    expect(screen.getByText("This releases the desk for others.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep booking" })).toBeInTheDocument();
  });

  it("fires onConfirm and onClose from the respective buttons", () => {
    const { onConfirm, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep booking" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while loading", () => {
    setup({ loading: true });
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep booking" })).toBeDisabled();
  });

  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        message="Hidden"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
