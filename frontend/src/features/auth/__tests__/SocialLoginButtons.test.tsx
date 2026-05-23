import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { SocialLoginButtons } from "../components/SocialLoginButtons";
import { en } from "@/i18n/en";

const mockTriggerGoogle = vi.fn();
const mockLoginPopup = vi.fn();

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn(() => mockTriggerGoogle),
}));

vi.mock("@azure/msal-react", () => ({
  useMsal: vi.fn(() => ({
    instance: { loginPopup: mockLoginPopup },
  })),
}));

const mockUseGoogleLogin = vi.mocked(useGoogleLogin);

type Props = React.ComponentProps<typeof SocialLoginButtons>;

function renderButtons(props: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <SocialLoginButtons
        isGoogleConfigured={true}
        isMicrosoftConfigured={true}
        onGoogleStart={vi.fn()}
        onGoogleToken={vi.fn()}
        onGoogleError={vi.fn()}
        onGoogleUnavailable={vi.fn()}
        onMicrosoftStart={vi.fn()}
        onMicrosoftToken={vi.fn()}
        onMicrosoftError={vi.fn()}
        onMicrosoftUnavailable={vi.fn()}
        loadingProvider={undefined}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGoogleLogin.mockReturnValue(mockTriggerGoogle);
  });

  // --- rendering ---

  it("renders Google and Microsoft buttons", () => {
    renderButtons();
    expect(
      screen.getByRole("button", { name: en.auth.social.continueWithGoogle })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft })
    ).toBeInTheDocument();
  });

  it("renders the or divider", () => {
    renderButtons();
    expect(screen.getByText(en.auth.social.orDivider)).toBeInTheDocument();
  });

  it("displays generalError when provided", () => {
    renderButtons({ generalError: en.auth.social.googleError });
    expect(screen.getByText(en.auth.social.googleError)).toBeInTheDocument();
  });

  // --- Google configured flow ---

  it("calls onGoogleStart and triggers Google SDK on button click", async () => {
    const user = userEvent.setup();
    const onGoogleStart = vi.fn();
    renderButtons({ onGoogleStart });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(onGoogleStart).toHaveBeenCalledTimes(1);
    expect(mockTriggerGoogle).toHaveBeenCalledTimes(1);
  });

  it("calls onGoogleToken when Google onSuccess fires", () => {
    const onGoogleToken = vi.fn();
    mockUseGoogleLogin.mockImplementationOnce((options) => {
      const opts = options as { onSuccess?: (r: { access_token: string }) => void };
      return () => opts.onSuccess?.({ access_token: "google-tok" });
    });
    renderButtons({ onGoogleToken });
    screen.getByRole("button", { name: en.auth.social.continueWithGoogle }).click();
    expect(onGoogleToken).toHaveBeenCalledWith("google-tok");
  });

  it("calls onGoogleError when Google onError fires", () => {
    const onGoogleError = vi.fn();
    mockUseGoogleLogin.mockImplementationOnce((options) => {
      const opts = options as { onError?: () => void };
      return () => opts.onError?.();
    });
    renderButtons({ onGoogleError });
    screen.getByRole("button", { name: en.auth.social.continueWithGoogle }).click();
    expect(onGoogleError).toHaveBeenCalledTimes(1);
  });

  // --- Google unavailable ---

  it("calls onGoogleUnavailable and does not trigger SDK when Google is not configured", async () => {
    const user = userEvent.setup();
    const onGoogleUnavailable = vi.fn();
    renderButtons({ isGoogleConfigured: false, onGoogleUnavailable });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(onGoogleUnavailable).toHaveBeenCalledTimes(1);
    expect(mockTriggerGoogle).not.toHaveBeenCalled();
  });

  it("does not call onGoogleStart when Google is not configured", async () => {
    const user = userEvent.setup();
    const onGoogleStart = vi.fn();
    renderButtons({ isGoogleConfigured: false, onGoogleStart });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(onGoogleStart).not.toHaveBeenCalled();
  });

  // --- Microsoft configured flow ---

  it("calls onMicrosoftStart and then onMicrosoftToken on popup success", async () => {
    const user = userEvent.setup();
    const onMicrosoftStart = vi.fn();
    const onMicrosoftToken = vi.fn();
    mockLoginPopup.mockResolvedValueOnce({ idToken: "ms-id-token" });

    renderButtons({ onMicrosoftStart, onMicrosoftToken });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(onMicrosoftStart).toHaveBeenCalledTimes(1);
      expect(onMicrosoftToken).toHaveBeenCalledWith("ms-id-token");
    });
  });

  it("calls onMicrosoftError when popup throws", async () => {
    const user = userEvent.setup();
    const onMicrosoftError = vi.fn();
    const popupError = new Error("Some MSAL error");
    mockLoginPopup.mockRejectedValueOnce(popupError);

    renderButtons({ onMicrosoftError });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(onMicrosoftError).toHaveBeenCalledWith(popupError);
    });
  });

  it("calls onMicrosoftError with cancelled error when popup is cancelled", async () => {
    const user = userEvent.setup();
    const onMicrosoftError = vi.fn();
    const cancelledError = Object.assign(new Error("Cancelled"), { errorCode: "user_cancelled" });
    mockLoginPopup.mockRejectedValueOnce(cancelledError);

    renderButtons({ onMicrosoftError });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(onMicrosoftError).toHaveBeenCalledWith(cancelledError);
    });
  });

  it("does not call onMicrosoftToken when popup throws", async () => {
    const user = userEvent.setup();
    const onMicrosoftToken = vi.fn();
    mockLoginPopup.mockRejectedValueOnce(new Error("error"));

    renderButtons({ onMicrosoftToken });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(onMicrosoftToken).not.toHaveBeenCalled();
    });
  });

  // --- Microsoft unavailable ---

  it("calls onMicrosoftUnavailable and does not call loginPopup when Microsoft is not configured", async () => {
    const user = userEvent.setup();
    const onMicrosoftUnavailable = vi.fn();
    renderButtons({ isMicrosoftConfigured: false, onMicrosoftUnavailable });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));
    expect(onMicrosoftUnavailable).toHaveBeenCalledTimes(1);
    expect(mockLoginPopup).not.toHaveBeenCalled();
  });

  it("does not call onMicrosoftStart when Microsoft is not configured", async () => {
    const user = userEvent.setup();
    const onMicrosoftStart = vi.fn();
    renderButtons({ isMicrosoftConfigured: false, onMicrosoftStart });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));
    expect(onMicrosoftStart).not.toHaveBeenCalled();
  });

  // --- per-provider loading ---

  it("shows loading text for Google when loadingProvider is google", () => {
    renderButtons({ loadingProvider: "google" });
    expect(screen.getByRole("button", { name: en.auth.social.loadingGoogle })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.auth.social.continueWithGoogle })
    ).not.toBeInTheDocument();
  });

  it("disables Microsoft button when loadingProvider is google", () => {
    renderButtons({ loadingProvider: "google" });
    expect(
      screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft })
    ).toBeDisabled();
  });

  it("shows loading text for Microsoft when loadingProvider is microsoft", () => {
    renderButtons({ loadingProvider: "microsoft" });
    expect(
      screen.getByRole("button", { name: en.auth.social.loadingMicrosoft })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.auth.social.continueWithMicrosoft })
    ).not.toBeInTheDocument();
  });

  it("disables Google button when loadingProvider is microsoft", () => {
    renderButtons({ loadingProvider: "microsoft" });
    expect(screen.getByRole("button", { name: en.auth.social.continueWithGoogle })).toBeDisabled();
  });

  it("disables both buttons when any provider is loading", () => {
    renderButtons({ loadingProvider: "google" });
    const googleBtn = screen.getByRole("button", { name: en.auth.social.loadingGoogle });
    const msBtn = screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft });
    expect(googleBtn).toBeDisabled();
    expect(msBtn).toBeDisabled();
  });
});
