import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardQuickActions } from "../DashboardQuickActions";
import { en } from "@/i18n/en";

function renderActions(isOwnerOrAdmin: boolean) {
  return render(
    <MemoryRouter>
      <DashboardQuickActions isOwnerOrAdmin={isOwnerOrAdmin} firstOffice={null} firstFloor={null} />
    </MemoryRouter>
  );
}

describe("DashboardQuickActions — Book a room (PR 075)", () => {
  it("shows a 'Book a room' quick action linking the room page for members", () => {
    renderActions(false);
    const link = screen.getByRole("link", { name: en.app.dashboard.actionBookRoom });
    expect(link).toHaveAttribute("href", "/app/bookings/rooms");
  });

  it("shows a 'Book a room' quick action for admins alongside 'Book a desk'", () => {
    renderActions(true);
    expect(screen.getByRole("link", { name: en.app.dashboard.actionBookDesk })).toHaveAttribute(
      "href",
      "/app/bookings"
    );
    expect(screen.getByRole("link", { name: en.app.dashboard.actionBookRoom })).toHaveAttribute(
      "href",
      "/app/bookings/rooms"
    );
  });
});
