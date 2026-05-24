import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MfaSetupPage } from "../pages/MfaSetupPage";
import { setupMfa, confirmMfa } from "../api/authApi";
import { ApiError } from "@/lib/api/apiError";
import { en } from "@/i18n/en";
import { ROUTES } from "@/routes/paths";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../api/authApi", () => ({
  setupMfa: vi.fn(),
  confirmMfa: vi.fn(),
}));

const mockSetupMfa = vi.mocked(setupMfa);
const mockConfirmMfa = vi.mocked(confirmMfa);

const FAKE_QR_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FAKE_URI =
  "otpauth://totp/WorkspaceCanvas:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=WorkspaceCanvas";

const MOCK_SETUP_RESPONSE = {
  provisioning_uri: FAKE_URI,
  qr_code_base64: FAKE_QR_B64,
  detail: "Scan the QR code.",
};

const MOCK_CODES_RESPONSE = {
  detail: "MFA enabled.",
  recovery_codes: ["code1abc", "code2def", "code3ghi", "code4jkl"],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.mfaSetup]}>
      <MfaSetupPage />
    </MemoryRouter>
  );
}

describe("MfaSetupPage — loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupMfa.mockReturnValue(new Promise(() => {}));
  });

  it("shows loading spinner while setup initialises", () => {
    renderPage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(en.auth.mfaSetup.loadingMessage)).toBeInTheDocument();
  });
});

describe("MfaSetupPage — error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupMfa.mockRejectedValue(new ApiError(500, "fail"));
  });

  it("shows error alert when setup API call fails", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("Failed to initialize MFA setup. Please try again.")
      ).toBeInTheDocument();
    });
  });
});

describe("MfaSetupPage — scan state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupMfa.mockResolvedValue(MOCK_SETUP_RESPONSE);
  });

  it("renders QR code image after setup", async () => {
    renderPage();
    const img = await screen.findByRole("img", { name: /MFA QR code/i });
    expect(img).toHaveAttribute("src", `data:image/png;base64,${FAKE_QR_B64}`);
  });

  it("shows the extracted manual secret", async () => {
    renderPage();
    await screen.findByRole("img", { name: /MFA QR code/i });
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
  });

  it("shows manual entry hint text", async () => {
    renderPage();
    await screen.findByRole("img");
    expect(screen.getByText(en.auth.mfaSetup.manualEntry)).toBeInTheDocument();
  });

  it("shows token input and submit button", async () => {
    renderPage();
    await screen.findByRole("img");
    expect(screen.getByLabelText(en.auth.mfaSetup.confirmLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit })
    ).toBeInTheDocument();
  });

  it("shows validation error when token is empty", async () => {
    renderPage();
    await screen.findByRole("img");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    expect(screen.getByText(en.auth.mfaSetup.invalidCodeRequired)).toBeInTheDocument();
    expect(mockConfirmMfa).not.toHaveBeenCalled();
  });

  it("shows validation error for non-6-digit token", async () => {
    renderPage();
    await screen.findByRole("img");
    await userEvent.type(screen.getByLabelText(en.auth.mfaSetup.confirmLabel), "12345");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    expect(screen.getByText(en.auth.mfaSetup.invalidCodeFormat)).toBeInTheDocument();
    expect(mockConfirmMfa).not.toHaveBeenCalled();
  });

  it("calls confirmMfa with the entered token", async () => {
    mockConfirmMfa.mockResolvedValue(MOCK_CODES_RESPONSE);
    renderPage();
    await screen.findByRole("img");
    await userEvent.type(screen.getByLabelText(en.auth.mfaSetup.confirmLabel), "123456");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    await waitFor(() => expect(mockConfirmMfa).toHaveBeenCalledWith({ token: "123456" }));
  });

  it("shows API error when confirmMfa fails", async () => {
    mockConfirmMfa.mockRejectedValue(new ApiError(400, "invalid token"));
    renderPage();
    await screen.findByRole("img");
    await userEvent.type(screen.getByLabelText(en.auth.mfaSetup.confirmLabel), "123456");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    await waitFor(() => {
      expect(screen.getByText(/Verification failed/i)).toBeInTheDocument();
    });
  });
});

describe("MfaSetupPage — recovery codes state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupMfa.mockResolvedValue(MOCK_SETUP_RESPONSE);
    mockConfirmMfa.mockResolvedValue(MOCK_CODES_RESPONSE);
  });

  it("shows recovery codes after successful confirmation", async () => {
    renderPage();
    await screen.findByRole("img");
    await userEvent.type(screen.getByLabelText(en.auth.mfaSetup.confirmLabel), "123456");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    await waitFor(() => {
      expect(screen.getByText("code1abc")).toBeInTheDocument();
      expect(screen.getByText("code4jkl")).toBeInTheDocument();
    });
    expect(screen.getByText(en.auth.mfaSetup.codesTitle)).toBeInTheDocument();
  });

  it("navigates to /app when done button is clicked", async () => {
    renderPage();
    await screen.findByRole("img");
    await userEvent.type(screen.getByLabelText(en.auth.mfaSetup.confirmLabel), "123456");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.confirmSubmit }));
    await screen.findByText("code1abc");
    await userEvent.click(screen.getByRole("button", { name: en.auth.mfaSetup.codesDone }));
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.app);
  });
});
