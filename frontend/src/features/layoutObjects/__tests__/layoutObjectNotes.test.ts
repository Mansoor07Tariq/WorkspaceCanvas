import { describe, it, expect } from "vitest";
import { getObjectNotes } from "../utils/layoutObjectNotes";

// Coverage gap in the owner's notes feature (PR 065): getObjectNotes had no test.
// Notes are stored inside the object's free-form `metadata` JSON, so the helper
// has to coerce anything non-string (or missing) to "".
describe("getObjectNotes", () => {
  it("returns the notes string when metadata.notes is a string", () => {
    expect(getObjectNotes({ metadata: { notes: "Near the window" } })).toBe("Near the window");
  });

  it("returns an empty string when notes is absent", () => {
    expect(getObjectNotes({ metadata: {} })).toBe("");
    expect(getObjectNotes({ metadata: { color: "#fff" } })).toBe("");
  });

  it("returns an empty string when notes is present but not a string", () => {
    expect(getObjectNotes({ metadata: { notes: 42 } })).toBe("");
    expect(getObjectNotes({ metadata: { notes: { nested: true } } })).toBe("");
    expect(getObjectNotes({ metadata: { notes: null } })).toBe("");
  });

  it("preserves an empty-string note (a deliberately cleared note)", () => {
    expect(getObjectNotes({ metadata: { notes: "" } })).toBe("");
  });
});
