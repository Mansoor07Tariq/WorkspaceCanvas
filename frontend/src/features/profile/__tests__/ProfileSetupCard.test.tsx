import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileSetupCard } from "../components/ProfileSetupCard";
import { en } from "@/i18n/en";
import type { CurrentUser } from "@/features/auth/types/auth.types";

const mockSetAuthenticatedUser = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({ setAuthenticatedUser: mockSetAuthenticatedUser }),
}));

vi.mock("../api/profileApi", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

const updatedUser: CurrentUser = {
  id: 1,
  username: "user@example.com",
  email: "user@example.com",
  full_name: "Jane Smith",
  first_name: "Jane",
  last_name: "Smith",
  avatar: null,
  phone_number: "",
  job_title: "",
  timezone: "UTC",
  locale: "en",
  is_profile_completed: true,
  email_verified: true,
  preferred_auth_provider: "email",
  mfa_enabled: false,
  memberships: [],
};

function renderCard() {
  return render(<ProfileSetupCard />);
}

describe("ProfileSetupCard — rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the setup title", () => {
    renderCard();
    expect(screen.getByText(en.app.profile.setupTitle)).toBeInTheDocument();
  });

  it("renders the setup subtitle", () => {
    renderCard();
    expect(screen.getByText(en.app.profile.setupSubtitle)).toBeInTheDocument();
  });

  it("renders the full name field", () => {
    renderCard();
    expect(screen.getByLabelText(en.app.profile.fullName)).toBeInTheDocument();
  });

  it("renders the job title field", () => {
    renderCard();
    expect(screen.getByLabelText(en.app.profile.jobTitle)).toBeInTheDocument();
  });

  it("renders the phone number field", () => {
    renderCard();
    expect(screen.getByLabelText(en.app.profile.phoneNumber)).toBeInTheDocument();
  });

  it("renders the save button", () => {
    renderCard();
    expect(screen.getByRole("button", { name: en.app.profile.saveButton })).toBeInTheDocument();
  });
});

describe("ProfileSetupCard — full name validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows required error and does not call API when full name is empty", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    expect(screen.getByRole("alert")).toHaveTextContent(en.app.profile.fullNameRequired);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("shows max-length error when full name exceeds 255 characters", async () => {
    const user = userEvent.setup();
    renderCard();
    fireEvent.change(screen.getByLabelText(en.app.profile.fullName), {
      target: { value: "a".repeat(256) },
    });
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    expect(screen.getByRole("alert")).toHaveTextContent(en.auth.validation.fullNameMaxLength);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("accepts exactly 255 characters", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    fireEvent.change(screen.getByLabelText(en.app.profile.fullName), {
      target: { value: "a".repeat(255) },
    });
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
  });
});

describe("ProfileSetupCard — phone number validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows invalid error for letters in phone number", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.app.profile.phoneNumber), "087hello");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    expect(screen.getByRole("alert")).toHaveTextContent(en.app.profile.phoneNumberInvalid);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("accepts a valid E.164-style phone number", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.app.profile.phoneNumber), "+353 87 123 4567");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
  });

  it("accepts parentheses and hyphens", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.app.profile.phoneNumber), "(087) 123-4567");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
  });
});

describe("ProfileSetupCard — successful submission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateProfile with trimmed full name", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "Jane Smith" });
    });
  });

  it("includes job_title when provided", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.app.profile.jobTitle), "Engineer");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        full_name: "Jane Smith",
        job_title: "Engineer",
      });
    });
  });

  it("includes phone_number trimmed when provided", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.type(screen.getByLabelText(en.app.profile.phoneNumber), "0871234567");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        full_name: "Jane Smith",
        phone_number: "0871234567",
      });
    });
  });

  it("omits phone_number when left empty", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "Jane Smith" });
    });
    const payload = mockUpdateProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("phone_number");
  });

  it("calls setAuthenticatedUser with the returned user", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(updatedUser);
    });
  });

  it("shows an API error alert on failure", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValueOnce({ response: { data: { detail: "Server error." } } });
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("disables the submit button while saving", async () => {
    const user = userEvent.setup();
    let resolve!: (v: CurrentUser) => void;
    mockUpdateProfile.mockReturnValueOnce(
      new Promise<CurrentUser>((r) => {
        resolve = r;
      })
    );
    renderCard();
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.saveButton }));
    expect(screen.getByRole("button", { name: en.app.profile.saveButton })).toBeDisabled();
    resolve(updatedUser);
  });
});
