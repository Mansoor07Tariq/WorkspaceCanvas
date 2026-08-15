import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { BottomTabBar } from "../BottomTabBar";
import { en } from "@/i18n/en";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
}));

function renderBar(path = "/app") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>
  );
}

describe("BottomTabBar (phone nav)", () => {
  it("renders the 4 primary destinations and not People", () => {
    renderBar();
    expect(screen.getByRole("button", { name: en.app.sidebar.today })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.app.sidebar.bookDesk })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.app.sidebar.bookRoom })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.app.sidebar.myBookingsNav })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.app.sidebar.people })).not.toBeInTheDocument();
  });

  it("navigates to the tapped destination", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: en.app.sidebar.bookDesk }));
    expect(mockNavigate).toHaveBeenCalledWith("/app/bookings");
  });
});
