import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OrganizationSwitcher } from "../components/OrganizationSwitcher";
import type { SelectedOrganizationValue } from "../context/SelectedOrganizationProvider";
import type { MembershipInline } from "@/features/auth/types/auth.types";

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseSelectedOrg = vi.fn<() => SelectedOrganizationValue>();
vi.mock("../context/SelectedOrganizationProvider", () => ({
  useSelectedOrganization: () => mockUseSelectedOrg(),
}));

function membership(orgId: number, name: string): MembershipInline {
  return {
    id: orgId,
    organization_id: orgId,
    organization_name: name,
    organization_slug: name.toLowerCase(),
    organization_status: "active",
    role: "owner",
    status: "active",
    has_active_access: true,
  };
}

const setSelected = vi.fn();

function renderSwitcher() {
  return render(
    <MemoryRouter>
      <OrganizationSwitcher />
    </MemoryRouter>
  );
}

describe("OrganizationSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing for a single-org user", () => {
    mockUseSelectedOrg.mockReturnValue({
      activeMemberships: [membership(10, "Acme")],
      selectedOrganizationId: 10,
      selectedMembership: membership(10, "Acme"),
      selectedOrganizationName: "Acme",
      setSelectedOrganizationId: setSelected,
      hasMultipleOrganizations: false,
    });
    renderSwitcher();
    expect(screen.queryByTestId("organization-switcher")).not.toBeInTheDocument();
  });

  it("renders a switcher for a multi-org user", () => {
    mockUseSelectedOrg.mockReturnValue({
      activeMemberships: [membership(10, "Acme"), membership(20, "Zephyr")],
      selectedOrganizationId: 10,
      selectedMembership: membership(10, "Acme"),
      selectedOrganizationName: "Acme",
      setSelectedOrganizationId: setSelected,
      hasMultipleOrganizations: true,
    });
    renderSwitcher();
    expect(screen.getByTestId("organization-switcher")).toBeInTheDocument();
  });

  it("switching org updates context and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    mockUseSelectedOrg.mockReturnValue({
      activeMemberships: [membership(10, "Acme"), membership(20, "Zephyr")],
      selectedOrganizationId: 10,
      selectedMembership: membership(10, "Acme"),
      selectedOrganizationName: "Acme",
      setSelectedOrganizationId: setSelected,
      hasMultipleOrganizations: true,
    });
    renderSwitcher();

    await user.click(within(screen.getByTestId("organization-switcher")).getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByRole("option", { name: "Zephyr" }));

    expect(setSelected).toHaveBeenCalledWith(20);
    expect(mockNavigate).toHaveBeenCalledWith("/app");
  });
});
