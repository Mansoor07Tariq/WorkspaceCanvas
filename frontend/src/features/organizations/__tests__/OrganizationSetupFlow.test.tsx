import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationSetupFlow } from "../components/OrganizationSetupFlow";
import { createOrganization } from "../api/organizationApi";
import { ApiError } from "@/lib/api/apiError";
import { en } from "@/i18n/en";

const c = en.app.orgSetup;

const mockRefreshUser = vi.fn();
const mockOnCreated = vi.fn();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock("../api/organizationApi", () => ({
  createOrganization: vi.fn(),
}));

const mockCreateOrg = vi.mocked(createOrganization);

const ORG_RESPONSE = {
  id: 1,
  name: "Acme Corp",
  slug: "acme-corp",
  organization_type: "company" as const,
  organization_type_display: "Company",
  allowed_email_domain: "",
  status: "active",
};

function renderFlow() {
  return render(<OrganizationSetupFlow onCreated={mockOnCreated} />);
}

describe("OrganizationSetupFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);
    mockCreateOrg.mockResolvedValue(ORG_RESPONSE);
  });

  it("renders the welcome step initially", () => {
    renderFlow();
    expect(screen.getByText(c.stepWelcomeTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.stepWelcomeCta })).toBeInTheDocument();
  });

  it("advances from welcome to name step on Get Started", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));

    expect(screen.getByText(c.stepNameTitle)).toBeInTheDocument();
  });

  it("blocks name step progression when name is empty", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.click(screen.getByRole("button", { name: c.next }));

    expect(screen.getByText(c.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(c.stepNameTitle)).toBeInTheDocument();
  });

  it("advances from name to type step when name is valid", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));

    expect(screen.getByText(c.stepTypeTitle)).toBeInTheDocument();
  });

  it("advances from type to domain step", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));

    expect(screen.getByText(c.stepDomainTitle)).toBeInTheDocument();
  });

  it("Skip button on domain step advances without validating the field", async () => {
    const user = userEvent.setup();
    renderFlow();

    // Navigate to domain step
    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));

    // Type an invalid domain
    await user.type(screen.getByRole("textbox"), "notadomain");

    // Click Skip — should advance without showing an error
    await user.click(screen.getByRole("button", { name: c.skip }));

    expect(screen.getByText(c.stepReviewTitle)).toBeInTheDocument();
    expect(screen.queryByText(/valid domain/i)).not.toBeInTheDocument();
  });

  it("Next button on domain step blocks when domain is invalid", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));

    await user.type(screen.getByRole("textbox"), "notadomain");
    await user.click(screen.getByRole("button", { name: c.next }));

    expect(screen.getByText(c.stepDomainTitle)).toBeInTheDocument();
    expect(screen.queryByText(c.stepReviewTitle)).not.toBeInTheDocument();
  });

  it("review step shows name and type summary", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.skip }));

    expect(screen.getByText(c.stepReviewTitle)).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.createButton })).toBeInTheDocument();
  });

  it("submit calls createOrganization and then refreshUser", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.skip }));
    await user.click(screen.getByRole("button", { name: c.createButton }));

    await waitFor(() => {
      expect(mockCreateOrg).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledTimes(1);
    });
  });

  it("shows API error message when submission fails", async () => {
    mockCreateOrg.mockRejectedValue(new ApiError(500, { detail: "Server error" }));

    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: c.stepWelcomeCta }));
    await user.type(screen.getByRole("textbox"), "Acme Corp");
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.next }));
    await user.click(screen.getByRole("button", { name: c.skip }));
    await user.click(screen.getByRole("button", { name: c.createButton }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });
});
