import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "../pages/SignupPage";
import { signup } from "../api/authApi";
import { ApiError } from "../../../lib/api/apiError";
import { en } from "@/i18n/en";

vi.mock("../api/authApi", () => ({
  signup: vi.fn(),
}));

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({
    setAuthenticatedUser: vi.fn(),
  }),
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => vi.fn()),
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(() => ({ instance: { loginPopup: vi.fn() } })),
  MsalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../social/socialConfig", () => ({
  msalInstance: {},
  isGoogleConfigured: true,
  isMicrosoftConfigured: true,
}));

const mockSignup = vi.mocked(signup);

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full name, email, password, and confirm password fields", () => {
    renderSignupPage();
    expect(screen.getByLabelText(en.auth.fields.fullName)).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.fields.email)).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.fields.password)).toBeInTheDocument();
    expect(screen.getByLabelText(en.auth.fields.confirmPassword)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    renderSignupPage();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows required validation error when email is missing", async () => {
    const user = userEvent.setup();
    renderSignupPage();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(en.auth.validation.emailRequired)).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "test@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.type(screen.getByLabelText(en.auth.fields.confirmPassword), "different!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(en.auth.validation.passwordMismatch)).toBeInTheDocument();
  });

  it("calls signup with the correct payload on valid submit", async () => {
    mockSignup.mockResolvedValueOnce({ detail: "Please verify your email." });
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText(en.auth.fields.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.auth.fields.email), "jane@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.type(screen.getByLabelText(en.auth.fields.confirmPassword), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith({
        full_name: "Jane Smith",
        email: "jane@example.com",
        password: "password123",
      });
    });
  });

  it("shows success state after successful signup", async () => {
    mockSignup.mockResolvedValueOnce({ detail: "Please verify your email." });
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "jane@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.type(screen.getByLabelText(en.auth.fields.confirmPassword), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(en.auth.signup.successTitle)).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows API error message when signup fails", async () => {
    mockSignup.mockRejectedValueOnce(
      new ApiError(400, { detail: "A user with this email already exists." })
    );
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "taken@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.type(screen.getByLabelText(en.auth.fields.confirmPassword), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
  });

  it("disables the submit button while loading", async () => {
    mockSignup.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText(en.auth.fields.email), "jane@example.com");
    await user.type(screen.getByLabelText(en.auth.fields.password), "password123");
    await user.type(screen.getByLabelText(en.auth.fields.confirmPassword), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    });
  });
});
