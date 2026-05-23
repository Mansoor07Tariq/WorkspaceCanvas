import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MfaChallengePage } from "../pages/MfaChallengePage";
import { verifyMfaChallenge } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "@/lib/api/apiError";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../api/authApi", () => ({
  verifyMfaChallenge: vi.fn(),
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    setTokens: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    getRefreshToken: vi.fn().mockReturnValue(null),
    clearTokens: vi.fn(),
  },
}));

const mockVerify = vi.mocked(verifyMfaChallenge);
const mockSetTokens = vi.mocked(tokenStorage.setTokens);

function renderMfaChallengePage(state?: { challengeId?: string; email?: string } | null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: ROUTES.mfaChallenge, state: state ?? null }]}>
      <MfaChallengePage />
    </MemoryRouter>
  );
}

describe("MfaChallengePage — missing challenge state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows missing challenge title when no state is provided", () => {
    renderMfaChallengePage(null);
    expect(screen.getByText(en.auth.mfaChallenge.missingChallengeTitle)).toBeInTheDocument();
  });

  it("shows missing challenge message when challengeId is absent", () => {
    renderMfaChallengePage({});
    expect(screen.getByText(en.auth.mfaChallenge.missingChallengeMessage)).toBeInTheDocument();
  });

  it("shows back to login link when challenge is missing", () => {
    renderMfaChallengePage(null);
    expect(screen.getByText(en.auth.mfaChallenge.backToLogin)).toBeInTheDocument();
  });

  it("does not render the form when challenge is missing", () => {
    renderMfaChallengePage(null);
    expect(
      screen.queryByRole("button", { name: en.auth.mfaChallenge.submit })
    ).not.toBeInTheDocument();
  });
});

describe("MfaChallengePage — TOTP mode", () => {
  const challengeState = { challengeId: "uuid-abc-123", email: "user@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the authenticator code field", () => {
    renderMfaChallengePage(challengeState);
    expect(screen.getByLabelText(en.auth.mfaChallenge.codeLabel)).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    renderMfaChallengePage(challengeState);
    expect(screen.getByRole("button", { name: en.auth.mfaChallenge.submit })).toBeInTheDocument();
  });

  it("renders the back to login link", () => {
    renderMfaChallengePage(challengeState);
    expect(screen.getByText(en.auth.mfaChallenge.backToLogin)).toBeInTheDocument();
  });

  it("renders the toggle to recovery code button", () => {
    renderMfaChallengePage(challengeState);
    expect(
      screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode })
    ).toBeInTheDocument();
  });

  it("shows validation error when token is empty", async () => {
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    expect(await screen.findByText(en.auth.mfaChallenge.invalidCodeRequired)).toBeInTheDocument();
  });

  it("shows validation error when token format is invalid", async () => {
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "abc");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    expect(await screen.findByText(en.auth.mfaChallenge.invalidCodeFormat)).toBeInTheDocument();
  });

  it("calls verifyMfaChallenge with challenge_id and token", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "123456");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith({
        challenge_id: "uuid-abc-123",
        token: "123456",
      });
    });
  });

  it("stores tokens after successful TOTP verification", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "123456");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith("tok-a", "tok-r");
    });
  });

  it("navigates to /app after successful TOTP verification", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "123456");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app);
    });
  });

  it("does not store tokens on API error", async () => {
    mockVerify.mockRejectedValueOnce(new ApiError(400, { detail: "Invalid token." }));
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "999999");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockSetTokens).not.toHaveBeenCalled();
    });
  });

  it("shows backend detail error when API returns a general error", async () => {
    mockVerify.mockRejectedValueOnce(new ApiError(400, { detail: "MFA challenge has expired." }));
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "999999");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    expect(await screen.findByText("MFA challenge has expired.")).toBeInTheDocument();
  });

  it("disables submit button while loading", async () => {
    mockVerify.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.codeLabel), "123456");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: en.auth.mfaChallenge.submit })).toBeDisabled();
    });
  });
});

describe("MfaChallengePage — recovery code mode", () => {
  const challengeState = { challengeId: "uuid-abc-123", email: "user@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches to recovery code mode when toggle is clicked", async () => {
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode }));
    expect(screen.getByLabelText(en.auth.mfaChallenge.recoveryCodeLabel)).toBeInTheDocument();
    expect(screen.queryByLabelText(en.auth.mfaChallenge.codeLabel)).not.toBeInTheDocument();
  });

  it("shows toggle back to authenticator button in recovery mode", async () => {
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode }));
    expect(
      screen.getByRole("button", { name: en.auth.mfaChallenge.useAuthenticatorCode })
    ).toBeInTheDocument();
  });

  it("calls verifyMfaChallenge with challenge_id and recovery_code", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode }));
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.recoveryCodeLabel), "ABCD-1234");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith({
        challenge_id: "uuid-abc-123",
        recovery_code: "ABCD-1234",
      });
    });
  });

  it("stores tokens after successful recovery code verification", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode }));
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.recoveryCodeLabel), "ABCD-1234");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith("tok-a", "tok-r");
    });
  });

  it("navigates to /app after successful recovery code verification", async () => {
    mockVerify.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderMfaChallengePage(challengeState);
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.useRecoveryCode }));
    await user.type(screen.getByLabelText(en.auth.mfaChallenge.recoveryCodeLabel), "ABCD-1234");
    await user.click(screen.getByRole("button", { name: en.auth.mfaChallenge.submit }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app);
    });
  });
});
