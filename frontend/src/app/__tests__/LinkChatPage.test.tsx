import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LinkChatPage } from "../pages/LinkChatPage";
import { ApiError } from "@/lib/api/apiError";

const mockConfirm = vi.fn();
vi.mock("@/features/chat/api/chatLinkApi", () => ({
  confirmChatLink: (...args: unknown[]) => mockConfirm(...args),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LinkChatPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LinkChatPage", () => {
  it("shows the confirm prompt when a code is present", () => {
    renderAt("/app/link-chat?code=abc");
    expect(screen.getByTestId("link-confirm")).toBeInTheDocument();
  });

  it("links the account on confirm and shows the linked email", async () => {
    mockConfirm.mockResolvedValue({
      status: "linked",
      platform: "slack",
      linked_email: "jane@example.com",
    });
    renderAt("/app/link-chat?code=abc");
    await userEvent.click(screen.getByTestId("link-confirm"));
    await waitFor(() => expect(screen.getByTestId("link-success")).toBeInTheDocument());
    expect(screen.getByTestId("link-success")).toHaveTextContent("jane@example.com");
    expect(mockConfirm).toHaveBeenCalledWith("abc");
  });

  it("shows the expired state when the API reports code=expired", async () => {
    mockConfirm.mockRejectedValue(new ApiError(400, { code: "expired" }));
    renderAt("/app/link-chat?code=abc");
    await userEvent.click(screen.getByTestId("link-confirm"));
    await waitFor(() => expect(screen.getByTestId("link-expired")).toBeInTheDocument());
  });

  it("shows the used state when the API reports code=used", async () => {
    mockConfirm.mockRejectedValue(new ApiError(400, { code: "used" }));
    renderAt("/app/link-chat?code=abc");
    await userEvent.click(screen.getByTestId("link-confirm"));
    await waitFor(() => expect(screen.getByTestId("link-used")).toBeInTheDocument());
  });

  it("shows the invalid state when no code is present", () => {
    renderAt("/app/link-chat");
    expect(screen.getByTestId("link-invalid")).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
