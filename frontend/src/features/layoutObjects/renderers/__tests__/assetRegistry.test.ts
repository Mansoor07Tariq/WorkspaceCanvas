import { describe, it, expect } from "vitest";
import { isometricAssetRegistry, getIsometricAsset } from "../isometric/assetRegistry";
import type { LayoutObjectType } from "../../types/layoutObject.types";

describe("isometric asset registry", () => {
  it("has an asset definition for desk", () => {
    const asset = getIsometricAsset("desk");
    expect(asset).toBeDefined();
    expect(asset?.src).toBeTruthy();
    expect(asset?.alt).toBe("Desk");
  });

  it("has an asset definition for meeting_room", () => {
    const asset = getIsometricAsset("meeting_room");
    expect(asset).toBeDefined();
    expect(asset?.src).toBeTruthy();
    expect(asset?.alt).toBe("Meeting room");
  });

  it("returns undefined for an unregistered type (safe fallback)", () => {
    expect(getIsometricAsset("chair")).toBeUndefined();
    expect(getIsometricAsset("wall")).toBeUndefined();
    expect(getIsometricAsset("not_a_real_type" as LayoutObjectType)).toBeUndefined();
  });

  it("registers exactly the proof-of-concept types", () => {
    expect(Object.keys(isometricAssetRegistry).sort()).toEqual(["desk", "meeting_room"]);
  });
});
