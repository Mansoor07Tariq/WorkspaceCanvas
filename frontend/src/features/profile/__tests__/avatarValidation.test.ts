import { describe, it, expect } from "vitest";
import { validateAvatarFile } from "../utils/avatarValidation";
import { en } from "@/i18n/en";

function makeFile(type: string, sizeBytes: number): File {
  const buf = new Uint8Array(sizeBytes);
  return new File([buf], "test.img", { type });
}

describe("validateAvatarFile", () => {
  it("returns null for a valid JPEG under 2 MB", () => {
    expect(validateAvatarFile(makeFile("image/jpeg", 100))).toBeNull();
  });

  it("returns null for a valid PNG under 2 MB", () => {
    expect(validateAvatarFile(makeFile("image/png", 100))).toBeNull();
  });

  it("returns null for a valid WebP under 2 MB", () => {
    expect(validateAvatarFile(makeFile("image/webp", 100))).toBeNull();
  });

  it("rejects a file over 2 MB", () => {
    const oversize = 2 * 1024 * 1024 + 1;
    expect(validateAvatarFile(makeFile("image/jpeg", oversize))).toBe(
      en.app.profile.carousel.avatarTooLarge
    );
  });

  it("rejects SVG", () => {
    expect(validateAvatarFile(makeFile("image/svg+xml", 100))).toBe(
      en.app.profile.carousel.avatarInvalidType
    );
  });

  it("rejects GIF", () => {
    expect(validateAvatarFile(makeFile("image/gif", 100))).toBe(
      en.app.profile.carousel.avatarInvalidType
    );
  });
});
