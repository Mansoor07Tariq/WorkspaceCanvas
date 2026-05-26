import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { SocialLoginButtons } from "../components/SocialLoginButtons";
import type { SocialProviderConfig } from "../hooks/useSocialLogin";
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

function makeProvider(overrides: Partial<SocialProviderConfig> = {}): SocialProviderConfig {
  return {
    configured: true,
    onStart: vi.fn(),
    onToken: vi.fn(),
    onError: vi.fn(),
    onUnavailable: vi.fn(),
    ...overrides,
  };
}

function renderButtons(props: Partial<Props> = {}) {
  return render(
    <MemoryRouter>
      <SocialLoginButtons
        google={makeProvider()}
        microsoft={makeProvider()}
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

  it("calls onStart and triggers Google SDK on button click", async () => {
    const user = userEvent.setup();
    const google = makeProvider({ onStart: vi.fn() });
    renderButtons({ google });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(google.onStart).toHaveBeenCalledTimes(1);
    expect(mockTriggerGoogle).toHaveBeenCalledTimes(1);
  });

  it("calls onToken when Google onSuccess fires", () => {
    const google = makeProvider({ onToken: vi.fn() });
    mockUseGoogleLogin.mockImplementationOnce((options) => {
      const opts = options as { onSuccess?: (r: { access_token: string }) => void };
      return () => opts.onSuccess?.({ access_token: "google-tok" });
    });
    renderButtons({ google });
    screen.getByRole("button", { name: en.auth.social.continueWithGoogle }).click();
    expect(google.onToken).toHaveBeenCalledWith("google-tok");
  });

  it("calls onError when Google onError fires", () => {
    const google = makeProvider({ onError: vi.fn() });
    mockUseGoogleLogin.mockImplementationOnce((options) => {
      const opts = options as { onError?: () => void };
      return () => opts.onError?.();
    });
    renderButtons({ google });
    screen.getByRole("button", { name: en.auth.social.continueWithGoogle }).click();
    expect(google.onError).toHaveBeenCalledTimes(1);
  });

  // --- Google unavailable ---

  it("calls onUnavailable and does not trigger SDK when Google is not configured", async () => {
    const user = userEvent.setup();
    const google = makeProvider({ configured: false, onUnavailable: vi.fn() });
    renderButtons({ google });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(google.onUnavailable).toHaveBeenCalledTimes(1);
    expect(mockTriggerGoogle).not.toHaveBeenCalled();
  });

  it("does not call onStart when Google is not configured", async () => {
    const user = userEvent.setup();
    const google = makeProvider({ configured: false, onStart: vi.fn() });
    renderButtons({ google });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithGoogle }));
    expect(google.onStart).not.toHaveBeenCalled();
  });

  // --- Microsoft configured flow ---

  it("calls onStart and then onToken on popup success", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ onStart: vi.fn(), onToken: vi.fn() });
    mockLoginPopup.mockResolvedValueOnce({ idToken: "ms-id-token" });

    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(microsoft.onStart).toHaveBeenCalledTimes(1);
      expect(microsoft.onToken).toHaveBeenCalledWith("ms-id-token");
    });
  });

  it("calls onError when popup throws", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ onError: vi.fn() });
    const popupError = new Error("Some MSAL error");
    mockLoginPopup.mockRejectedValueOnce(popupError);

    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(microsoft.onError).toHaveBeenCalledWith(popupError);
    });
  });

  it("calls onError with cancelled error when popup is cancelled", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ onError: vi.fn() });
    const cancelledError = Object.assign(new Error("Cancelled"), { errorCode: "user_cancelled" });
    mockLoginPopup.mockRejectedValueOnce(cancelledError);

    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(microsoft.onError).toHaveBeenCalledWith(cancelledError);
    });
  });

  it("does not call onToken when popup throws", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ onToken: vi.fn() });
    mockLoginPopup.mockRejectedValueOnce(new Error("error"));

    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));

    await vi.waitFor(() => {
      expect(microsoft.onToken).not.toHaveBeenCalled();
    });
  });

  // --- Microsoft unavailable ---

  it("calls onUnavailable and does not call loginPopup when Microsoft is not configured", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ configured: false, onUnavailable: vi.fn() });
    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));
    expect(microsoft.onUnavailable).toHaveBeenCalledTimes(1);
    expect(mockLoginPopup).not.toHaveBeenCalled();
  });

  it("does not call onStart when Microsoft is not configured", async () => {
    const user = userEvent.setup();
    const microsoft = makeProvider({ configured: false, onStart: vi.fn() });
    renderButtons({ microsoft });
    await user.click(screen.getByRole("button", { name: en.auth.social.continueWithMicrosoft }));
    expect(microsoft.onStart).not.toHaveBeenCalled();
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
