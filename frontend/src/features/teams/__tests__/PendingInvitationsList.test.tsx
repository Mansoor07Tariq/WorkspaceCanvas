import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { PendingInvitationsList } from "../components/PendingInvitationsList";
import type { Invitation } from "../types/teams.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

const baseInvitation: Invitation = {
  id: 10,
  email: "invited@example.com",
  role: "member",
  status: "pending",
  token: "abc-token-123",
  invited_by_email: "alice@example.com",
  accepted_by_email: null,
  expires_at: inDays(6),
  accepted_at: null,
  created_at: "2026-06-01T00:00:00Z",
};

function renderList(props: Partial<React.ComponentProps<typeof PendingInvitationsList>> = {}) {
  return render(
    <PendingInvitationsList
      invitations={[baseInvitation]}
      loading={false}
      resendingId={null}
      onCancel={vi.fn()}
      onResend={vi.fn()}
      {...props}
    />
  );
}

describe("PendingInvitationsList", () => {
  it("renders the expiry label for a pending invitation", () => {
    renderList();
    expect(screen.getByText("Expires in 6 days")).toBeInTheDocument();
  });

  it("renders an Expired chip for a past expiry", () => {
    renderList({
      invitations: [{ ...baseInvitation, expires_at: inDays(-3) }],
    });
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows a resend button per invitation", () => {
    renderList();
    expect(
      screen.getByRole("button", { name: /resend invitation to invited@example.com/i })
    ).toBeInTheDocument();
  });

  it("calls onResend with the invitation id when clicked", async () => {
    const onResend = vi.fn();
    const user = userEvent.setup();
    renderList({ onResend });
    await user.click(
      screen.getByRole("button", { name: /resend invitation to invited@example.com/i })
    );
    expect(onResend).toHaveBeenCalledWith(10);
  });

  it("disables the resend button while a resend is in flight", () => {
    renderList({ resendingId: 10 });
    expect(
      screen.getByRole("button", { name: /resend invitation to invited@example.com/i })
    ).toBeDisabled();
  });

  it("renders the invite link using the current token", () => {
    renderList();
    expect(screen.getByDisplayValue(/\/invite\/abc-token-123$/)).toBeInTheDocument();
  });
});
