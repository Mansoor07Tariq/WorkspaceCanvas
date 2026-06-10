import { afterEach, describe, expect, it } from "vitest";
import {
  clearPendingInviteToken,
  readPendingInvitePath,
  storePendingInviteToken,
} from "../pendingInviteToken";

afterEach(() => {
  window.sessionStorage.clear();
});

describe("pendingInviteToken", () => {
  it("stores a token and resolves it to a safe /invite path", () => {
    storePendingInviteToken("abc-123");
    expect(readPendingInvitePath()).toBe("/invite/abc-123");
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingInvitePath()).toBeNull();
  });

  it("clears the stored token", () => {
    storePendingInviteToken("abc-123");
    clearPendingInviteToken();
    expect(readPendingInvitePath()).toBeNull();
  });

  it("ignores an implausible token containing a slash (open-redirect guard)", () => {
    storePendingInviteToken("../evil");
    expect(window.sessionStorage.getItem("wc.pendingInviteToken")).toBeNull();
    expect(readPendingInvitePath()).toBeNull();
  });

  it("ignores an empty token", () => {
    storePendingInviteToken("");
    expect(readPendingInvitePath()).toBeNull();
  });
});
