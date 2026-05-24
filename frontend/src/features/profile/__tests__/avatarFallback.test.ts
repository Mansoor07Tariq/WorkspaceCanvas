import { describe, it, expect } from "vitest";
import { getAvatarInitials } from "../utils/avatarFallback";

describe("getAvatarInitials", () => {
  it("returns first and last initial for a two-word name", () => {
    expect(getAvatarInitials("Jane Smith")).toBe("JS");
  });

  it("returns first initial only for a single-word name", () => {
    expect(getAvatarInitials("Madonna")).toBe("M");
  });

  it("uses first and last word for a three-word name", () => {
    expect(getAvatarInitials("Mary Ann Jones")).toBe("MJ");
  });

  it("returns ? for an empty string", () => {
    expect(getAvatarInitials("")).toBe("?");
  });

  it("returns ? for whitespace only", () => {
    expect(getAvatarInitials("   ")).toBe("?");
  });

  it("uppercases initials from lowercase input", () => {
    expect(getAvatarInitials("alice b")).toBe("AB");
  });
});
