import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileOnboardingCarousel } from "../components/ProfileOnboardingCarousel";
import { en } from "@/i18n/en";
import { getProfileCompletionPercent } from "../utils/onboardingProgress";
import type { CurrentUser } from "@/features/auth/types/auth.types";

const mockSetAuthenticatedUser = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUploadAvatar = vi.fn();

const MOCK_USER = {
  email: "user@example.com",
  email_verified: true,
  full_name: "",
  job_title: "",
  phone_number: "",
  timezone: "UTC",
};

vi.mock("@/features/auth/context/AuthContext", () => ({
  useAuth: () => ({
    setAuthenticatedUser: mockSetAuthenticatedUser,
    user: MOCK_USER,
  }),
}));

vi.mock("../api/profileApi", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
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

function renderCarousel() {
  return render(<ProfileOnboardingCarousel />);
}

// Navigate from welcome → name → email → workDetails → avatar (ready to submit)
async function navigateToAvatar(user: ReturnType<typeof userEvent.setup>) {
  renderCarousel();
  // welcome step
  await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
  // name step
  await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
  await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
  // email step
  await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
  // workDetails step
  await user.click(screen.getByRole("button", { name: en.app.profile.carousel.skip }));
  // now on avatar step
  expect(screen.getByRole("button", { name: en.app.profile.carousel.finish })).toBeInTheDocument();
}

describe("ProfileOnboardingCarousel — welcome step", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the welcome title on mount", () => {
    renderCarousel();
    expect(screen.getByText(en.app.profile.carousel.stepWelcomeTitle)).toBeInTheDocument();
  });

  it("renders the Get started button on mount", () => {
    renderCarousel();
    expect(
      screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta })
    ).toBeInTheDocument();
  });

  it("does not show Back or Skip buttons on welcome step", () => {
    renderCarousel();
    expect(
      screen.queryByRole("button", { name: en.app.profile.carousel.back })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.app.profile.carousel.skip })
    ).not.toBeInTheDocument();
  });

  it("advances to name step after clicking Get started", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    expect(screen.getByText(en.app.profile.carousel.stepNameTitle)).toBeInTheDocument();
  });

  it("shows step progress on the welcome step", () => {
    renderCarousel();
    // MUI Stepper renders all step labels including the welcome step label
    expect(screen.getByText(en.app.profile.carousel.stepWelcome)).toBeInTheDocument();
  });

  it("shows profile completion progress bar", () => {
    renderCarousel();
    expect(screen.getByText(en.app.profile.carousel.profileCompletion)).toBeInTheDocument();
  });
});

describe("ProfileOnboardingCarousel — step progress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("step progress shows all six step labels", () => {
    renderCarousel();
    const c = en.app.profile.carousel;
    [c.stepWelcome, c.stepName, c.stepEmail, c.stepWorkDetails, c.stepAvatar, c.stepDone].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("completion percent increases after advancing past welcome", async () => {
    const user = userEvent.setup();
    renderCarousel();
    const initialPercent = getProfileCompletionPercent("welcome");
    expect(screen.getByText(`${initialPercent}%`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    const namePercent = getProfileCompletionPercent("name");
    expect(screen.getByText(`${namePercent}%`)).toBeInTheDocument();
    expect(namePercent).toBeGreaterThan(initialPercent);
  });

  it("completion percent reaches 82% on the avatar step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.skip }));
    // On avatar step (index 4) → 82%
    expect(screen.getByText("82%")).toBeInTheDocument();
  });
});

describe("ProfileOnboardingCarousel — name step", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows name step title after Get started", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    expect(screen.getByText(en.app.profile.carousel.stepNameTitle)).toBeInTheDocument();
  });

  it("shows required error when name is empty and Next clicked", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(screen.getByRole("alert")).toHaveTextContent(en.app.profile.fullNameRequired);
  });

  it("can go back from name step to welcome", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.back }));
    expect(screen.getByText(en.app.profile.carousel.stepWelcomeTitle)).toBeInTheDocument();
  });

  it("advances to email step after typing name and clicking Next", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(screen.getByText(en.app.profile.carousel.stepEmailTitle)).toBeInTheDocument();
  });
});

describe("ProfileOnboardingCarousel — email step", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows current user email on email step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(screen.getByText(MOCK_USER.email)).toBeInTheDocument();
  });

  it("shows verified chip when email_verified is true", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(screen.getByText(en.app.profile.carousel.stepEmailVerifiedLabel)).toBeInTheDocument();
  });

  it("can go back from email step to name step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.back }));
    expect(screen.getByText(en.app.profile.carousel.stepNameTitle)).toBeInTheDocument();
  });

  it("advances to work details step after clicking Next on email step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(
      screen.getByRole("heading", { name: en.app.profile.carousel.stepWorkDetailsTitle })
    ).toBeInTheDocument();
  });
});

describe("ProfileOnboardingCarousel — work details step", () => {
  beforeEach(() => vi.clearAllMocks());

  it("can skip work details step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.skip }));
    expect(
      screen.getByRole("heading", { name: en.app.profile.carousel.stepAvatarTitle })
    ).toBeInTheDocument();
  });

  it("shows phone error for invalid number on work details step", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.stepWelcomeCta }));
    await user.type(screen.getByLabelText(en.app.profile.fullName), "Jane Smith");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    await user.type(screen.getByLabelText(en.app.profile.phoneNumber), "abc123");
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.next }));
    expect(screen.getByRole("alert")).toHaveTextContent(en.app.profile.phoneNumberInvalid);
  });
});

describe("ProfileOnboardingCarousel — avatar step", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skip on avatar step submits profile without avatar", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.skip }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: "Jane Smith" })
      );
      expect(mockUploadAvatar).not.toHaveBeenCalled();
    });
  });

  it("skip on avatar step shows the setting-up transition overlay after submission", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.skip }));
    await waitFor(() => {
      expect(screen.getByText(en.app.profile.carousel.completingTitle)).toBeInTheDocument();
    });
  });

  it("shows the transition overlay after clicking Complete profile on avatar step", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    await waitFor(() => {
      expect(screen.getByText(en.app.profile.carousel.completingTitle)).toBeInTheDocument();
    });
  });
});

describe("ProfileOnboardingCarousel — completion transition (PR 057 Error 3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a full-screen status overlay with the setting-up message after finish", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    await waitFor(() => {
      // The overlay is a role="status" labelled with the setting-up message.
      const overlay = screen.getByRole("status", {
        name: en.app.profile.carousel.completingTitle,
      });
      expect(overlay).toBeInTheDocument();
    });
  });

  it("does not flip the auth user immediately — the hand-off is delayed by the overlay", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    // Overlay is up...
    await waitFor(() => {
      expect(screen.getByText(en.app.profile.carousel.completingTitle)).toBeInTheDocument();
    });
    // ...but the user has NOT been flipped yet (would swap away the carousel).
    expect(mockSetAuthenticatedUser).not.toHaveBeenCalled();
  });
});

describe("ProfileOnboardingCarousel — finish submission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls updateProfile with full_name when finishing", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: "Jane Smith" })
      );
    });
  });

  it("calls setAuthenticatedUser with the returned user once the transition completes", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValueOnce(updatedUser);
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    // The hand-off is delayed by the transition overlay (~2.2s); wait past it.
    await waitFor(
      () => {
        expect(mockSetAuthenticatedUser).toHaveBeenCalledWith(updatedUser);
      },
      { timeout: 4000 }
    );
  });

  it("shows an API error alert on failure", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValueOnce({ response: { data: { detail: "Server error." } } });
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("does not reach done screen if API call fails", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValueOnce({ response: { data: { detail: "Server error." } } });
    await navigateToAvatar(user);
    await user.click(screen.getByRole("button", { name: en.app.profile.carousel.finish }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByText(en.app.profile.carousel.stepDoneTitle)).not.toBeInTheDocument();
  });
});
