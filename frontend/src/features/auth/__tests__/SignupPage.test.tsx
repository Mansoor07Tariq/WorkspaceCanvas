import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "../pages/SignupPage";
import { signup } from "../api/authApi";
import { ApiError } from "../../../lib/api/apiError";

vi.mock("../api/authApi", () => ({
  signup: vi.fn(),
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
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    renderSignupPage();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows required validation error when email is missing", async () => {
    const user = userEvent.setup();
    renderSignupPage();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "different!");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("calls signup with the correct payload on valid submit", async () => {
    mockSignup.mockResolvedValueOnce({ detail: "Please verify your email." });
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText("Full name"), "Jane Smith");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
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
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows API error message when signup fails", async () => {
    mockSignup.mockRejectedValueOnce(
      new ApiError(400, { detail: "A user with this email already exists." })
    );
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText("Email"), "taken@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
  });

  it("disables the submit button while loading", async () => {
    mockSignup.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderSignupPage();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    });
  });
});
