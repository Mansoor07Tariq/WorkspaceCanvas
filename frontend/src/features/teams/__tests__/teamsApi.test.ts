import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listMembers,
  listInvitations,
  createInvitation,
  cancelInvitation,
  getInvitationByToken,
  acceptInvitation,
} from "../api/teamsApi";

vi.mock("@/lib/api/apiClient", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from "@/lib/api/apiClient";
const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);

beforeEach(() => vi.clearAllMocks());

describe("teamsApi", () => {
  it("listMembers calls correct URL", async () => {
    mockGet.mockResolvedValueOnce([]);
    await listMembers(10);
    expect(mockGet).toHaveBeenCalledWith("/api/accounts/organizations/10/members/");
  });

  it("listInvitations calls correct URL", async () => {
    mockGet.mockResolvedValueOnce([]);
    await listInvitations(10);
    expect(mockGet).toHaveBeenCalledWith("/api/accounts/organizations/10/invitations/");
  });

  it("createInvitation posts to correct URL with payload", async () => {
    const inv = { id: 1, email: "a@b.com", role: "member" };
    mockPost.mockResolvedValueOnce(inv);
    const result = await createInvitation(10, { email: "a@b.com", role: "member" });
    expect(mockPost).toHaveBeenCalledWith("/api/accounts/organizations/10/invitations/", {
      email: "a@b.com",
      role: "member",
    });
    expect(result).toEqual(inv);
  });

  it("cancelInvitation posts to correct URL", async () => {
    mockPost.mockResolvedValueOnce({});
    await cancelInvitation(10, 42);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/accounts/organizations/10/invitations/42/cancel/",
      {}
    );
  });

  it("getInvitationByToken calls correct URL", async () => {
    mockGet.mockResolvedValueOnce({ status: "pending" });
    await getInvitationByToken("abc-token");
    expect(mockGet).toHaveBeenCalledWith("/api/accounts/invitations/abc-token/");
  });

  it("acceptInvitation posts to correct URL", async () => {
    mockPost.mockResolvedValueOnce({});
    await acceptInvitation("abc-token");
    expect(mockPost).toHaveBeenCalledWith("/api/accounts/invitations/abc-token/accept/", {});
  });
});
