import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { verifyEmail, resendVerification } from "../api/authApi";
import { tokenStorage } from "@/lib/tokenStorage";
import { ApiError } from "@/lib/api/apiError";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

vi.mock("../api/authApi", () => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    clearTokens: vi.fn(),
  },
}));

const mockVerifyEmail = vi.mocked(verifyEmail);
const mockResendVerification = vi.mocked(resendVerification);
const mockSetAccessToken = vi.mocked(tokenStorage.setAccessToken);

function renderWithToken(token?: string) {
  const url = token ? `${ROUTES.verifyEmail}?token=${token}` : ROUTES.verifyEmail;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VerifyEmailPage />
    </MemoryRouter>
  );
}

describe("VerifyEmailPage — verifying state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls verifyEmail with the token from the URL", async () => {
    mockVerifyEmail.mockResolvedValueOnce({ detail: "Email verified." });
    renderWithToken("abc-token-123");
    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith({ token: "abc-token-123" });
    });
  });

  it("shows verifying state initially while API is pending", () => {
    mockVerifyEmail.mockImplementation(() => new Promise(() => {}));
    renderWithToken("some-token");
    expect(screen.getByText(en.auth.verifyEmail.verifyingMessage)).toBeInTheDocument();
  });

  it("calls verifyEmail exactly once even in React StrictMode", async () => {
    mockVerifyEmail.mockResolvedValue({ detail: "Email verified." });
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={[`${ROUTES.verifyEmail}?token=strict-token`]}>
          <VerifyEmailPage />
        </MemoryRouter>
      </React.StrictMode>
    );
    await screen.findByText(en.auth.verifyEmail.successMessage);
    expect(mockVerifyEmail).toHaveBeenCalledTimes(1);
  });
});

describe("VerifyEmailPage — success state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success state after verifyEmail resolves", async () => {
    mockVerifyEmail.mockResolvedValueOnce({ detail: "Email verified." });
    renderWithToken("valid-token");
    expect(await screen.findByText(en.auth.verifyEmail.successMessage)).toBeInTheDocument();
  });

  it("shows the success title", async () => {
    mockVerifyEmail.mockResolvedValueOnce({ detail: "Email verified." });
    renderWithToken("valid-token");
    expect(await screen.findByText(en.auth.verifyEmail.successTitle)).toBeInTheDocument();
  });

  it("shows a link to login in the success state", async () => {
    mockVerifyEmail.mockResolvedValueOnce({ detail: "Email verified." });
    renderWithToken("valid-token");
    expect(await screen.findByText(en.auth.verifyEmail.goToLogin)).toBeInTheDocument();
  });

  it("does not store tokens on successful email verification", async () => {
    mockVerifyEmail.mockResolvedValueOnce({ detail: "Email verified." });
    renderWithToken("valid-token");
    await screen.findByText(en.auth.verifyEmail.successMessage);
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});

describe("VerifyEmailPage — error state (API rejection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows error message from backend detail when verifyEmail rejects", async () => {
    mockVerifyEmail.mockRejectedValueOnce(
      new ApiError(400, { detail: "This verification link has expired." })
    );
    renderWithToken("expired-token");
    expect(await screen.findByText("This verification link has expired.")).toBeInTheDocument();
  });

  it("shows expired/invalid fallback when backend error is generic", async () => {
    mockVerifyEmail.mockRejectedValueOnce(new Error("Network error"));
    renderWithToken("bad-token");
    expect(
      await screen.findByText(en.auth.verifyEmail.expiredOrInvalidMessage)
    ).toBeInTheDocument();
  });

  it("shows back to login link in error state", async () => {
    mockVerifyEmail.mockRejectedValueOnce(new ApiError(400, { detail: "Invalid token." }));
    renderWithToken("bad-token");
    expect(await screen.findByText(en.auth.verifyEmail.backToLogin)).toBeInTheDocument();
  });

  it("renders the resend verification form in error state", async () => {
    mockVerifyEmail.mockRejectedValueOnce(new ApiError(400, { detail: "Invalid token." }));
    renderWithToken("bad-token");
    expect(
      await screen.findByRole("button", { name: en.auth.verifyEmail.resendSubmit })
    ).toBeInTheDocument();
  });
});

describe("VerifyEmailPage — missing token state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call verifyEmail when token is absent", () => {
    renderWithToken();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it("shows missing token error message", () => {
    renderWithToken();
    expect(screen.getByText(en.auth.verifyEmail.missingTokenMessage)).toBeInTheDocument();
  });

  it("shows the resend form when token is missing", () => {
    renderWithToken();
    expect(
      screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit })
    ).toBeInTheDocument();
  });
});

describe("VerifyEmailPage — resend form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation error when resend is submitted with empty email", async () => {
    const user = userEvent.setup();
    renderWithToken();
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    expect(await screen.findByText(en.auth.validation.emailRequired)).toBeInTheDocument();
  });

  it("shows validation error when resend email format is invalid", async () => {
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "not-an-email");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    expect(await screen.findByText(en.auth.validation.invalidEmail)).toBeInTheDocument();
  });

  it("calls resendVerification with the entered email", async () => {
    mockResendVerification.mockResolvedValueOnce({ detail: "Sent." });
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith({ email: "user@example.com" });
    });
  });

  it("shows resend success message after successful resend", async () => {
    mockResendVerification.mockResolvedValueOnce({ detail: "Sent." });
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    expect(await screen.findByText(en.auth.verifyEmail.resendSuccess)).toBeInTheDocument();
  });

  it("shows backend email field error from resend API", async () => {
    mockResendVerification.mockRejectedValueOnce(
      new ApiError(400, { email: ["Enter a valid email address."] })
    );
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("shows general error from resend API when no field errors", async () => {
    mockResendVerification.mockRejectedValueOnce(
      new ApiError(500, { detail: "Service temporarily unavailable." })
    );
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    expect(await screen.findByText("Service temporarily unavailable.")).toBeInTheDocument();
  });

  it("does not store tokens during resend flow", async () => {
    mockResendVerification.mockResolvedValueOnce({ detail: "Sent." });
    const user = userEvent.setup();
    renderWithToken();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: en.auth.verifyEmail.resendSubmit }));
    await screen.findByText(en.auth.verifyEmail.resendSuccess);
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});
