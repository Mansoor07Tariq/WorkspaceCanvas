import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseLastOfficeFloor,
  loadLastOfficeFloor,
  saveLastOfficeFloor,
} from "../utils/lastOfficeFloor";

describe("parseLastOfficeFloor (pure)", () => {
  it("parses a valid versioned payload", () => {
    expect(parseLastOfficeFloor('{"v":1,"office":2,"floor":3}')).toEqual({ office: 2, floor: 3 });
  });
  it("returns null for null / empty", () => {
    expect(parseLastOfficeFloor(null)).toBeNull();
    expect(parseLastOfficeFloor("")).toBeNull();
  });
  it("returns null for malformed JSON", () => {
    expect(parseLastOfficeFloor("{not json")).toBeNull();
  });
  it("returns null for the wrong version", () => {
    expect(parseLastOfficeFloor('{"v":2,"office":2,"floor":3}')).toBeNull();
  });
  it("returns null for non-positive / non-integer ids", () => {
    expect(parseLastOfficeFloor('{"v":1,"office":0,"floor":3}')).toBeNull();
    expect(parseLastOfficeFloor('{"v":1,"office":2.5,"floor":3}')).toBeNull();
    expect(parseLastOfficeFloor('{"v":1,"office":"2","floor":3}')).toBeNull();
    expect(parseLastOfficeFloor('{"v":1,"office":2}')).toBeNull();
  });
});

describe("save/load round-trip (localStorage)", () => {
  beforeEach(() => window.localStorage.clear());

  it("saves and loads the pair", () => {
    saveLastOfficeFloor(7, 9);
    expect(loadLastOfficeFloor()).toEqual({ office: 7, floor: 9 });
  });
  it("stores ONLY the ids + version (no personal data)", () => {
    saveLastOfficeFloor(7, 9);
    const raw = window.localStorage.getItem("wc.booking.lastOfficeFloor.v1");
    expect(JSON.parse(raw as string)).toEqual({ v: 1, office: 7, floor: 9 });
  });
  it("loads null when nothing is stored", () => {
    expect(loadLastOfficeFloor()).toBeNull();
  });
});

describe("defensive when storage is unavailable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("save never throws when setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveLastOfficeFloor(1, 2)).not.toThrow();
  });
  it("load returns null when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(loadLastOfficeFloor()).toBeNull();
  });
});
