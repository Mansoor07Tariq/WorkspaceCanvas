import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { login } from "../api/authApi";
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
  login: vi.fn(),
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    setTokens: vi.fn(),
    getAccessToken: vi.fn().mockReturnValue(null),
    getRefreshToken: vi.fn().mockReturnValue(null),
    clearTokens: vi.fn(),
  },
}));

const mockLogin = vi.mocked(login);
const mockSetTokens = vi.mocked(tokenStorage.setTokens);

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    renderLoginPage();
    expect(screen.getByLabelText(en.auth.fields.email)).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.fields.password)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderLoginPage();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders link to signup page", () => {
    renderLoginPage();
    expect(screen.getByText(en.auth.login.createAccount)).toBeInTheDocument();
  });

  it("shows email required error when email is empty", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(en.auth.validation.emailRequired)).toBeInTheDocument();
  });

  it("shows invalid email error when email format is wrong", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "not-an-email");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(en.auth.validation.invalidEmail)).toBeInTheDocument();
  });

  it("shows password required error when password is empty", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(en.auth.validation.passwordRequired)).toBeInTheDocument();
  });

  it("calls login API with correct payload on valid submit", async () => {
    mockLogin.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("stores tokens on normal login success", async () => {
    mockLogin.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith("tok-a", "tok-r");
    });
  });

  it("navigates to /app on normal login success", async () => {
    mockLogin.mockResolvedValueOnce({ access: "tok-a", refresh: "tok-r" });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app);
    });
  });

  it("does not store tokens when MFA is required", async () => {
    mockLogin.mockResolvedValueOnce({
      mfa_required: true,
      challenge_id: "uuid-123",
      detail: "MFA required",
    });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockSetTokens).not.toHaveBeenCalled();
    });
  });

  it("navigates to /mfa-challenge when MFA is required", async () => {
    mockLogin.mockResolvedValueOnce({
      mfa_required: true,
      challenge_id: "uuid-123",
      detail: "MFA required",
    });
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.mfaChallenge, {
        state: { challengeId: "uuid-123", email: "user@example.com" },
      });
    });
  });

  it("shows API error message when login fails", async () => {
    mockLogin.mockRejectedValueOnce(
      new ApiError(401, { detail: "No active account found with the given credentials." })
    );
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(
      await screen.findByText("No active account found with the given credentials.")
    ).toBeInTheDocument();
  });

  it("disables submit button while loading", async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "user@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    });
  });
});
