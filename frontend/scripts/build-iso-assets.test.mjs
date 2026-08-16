import { describe, it, expect } from "vitest";

import {
  deriveMeta,
  slugify,
  extractBase64Png,
  extractSvgDims,
  defaultFootprint,
} from "./build-iso-assets.mjs";

describe("deriveMeta — parses the REAL library names", () => {
  it("splits a descriptor variant (Desk+System-1 ALL)", () => {
    expect(deriveMeta("Desk+System-1 ALL")).toEqual({
      key: "desk-system-1-all",
      sourceName: "Desk+System-1 ALL",
      baseType: "Desk+System",
      variantIndex: 1,
      descriptor: "ALL",
    });
  });

  it("handles Less / Plant descriptors", () => {
    expect(deriveMeta("Desk+System-4 Less").descriptor).toBe("Less");
    expect(deriveMeta("Desk+System-2 Plant")).toMatchObject({
      baseType: "Desk+System",
      variantIndex: 2,
      descriptor: "Plant",
    });
  });

  it("keeps multi-word base types with an index (Meeting Room-2, Kitchen Table-1)", () => {
    expect(deriveMeta("Meeting Room-2")).toMatchObject({
      baseType: "Meeting Room",
      variantIndex: 2,
      descriptor: null,
    });
    expect(deriveMeta("Kitchen Table-1").baseType).toBe("Kitchen Table");
    expect(deriveMeta("Small Sofa-6")).toMatchObject({ baseType: "Small Sofa", variantIndex: 6 });
  });

  it("does NOT treat a leading/whole-name 'Plant' as a descriptor", () => {
    expect(deriveMeta("Plant-1")).toMatchObject({
      baseType: "Plant",
      variantIndex: 1,
      descriptor: null,
    });
    // "Plant Sofa side-3" → base type, not descriptor Plant
    expect(deriveMeta("Plant Sofa side-3")).toMatchObject({
      baseType: "Plant Sofa side",
      variantIndex: 3,
      descriptor: null,
    });
  });

  it("handles names with NO index (Long Table, Long Table with Benches)", () => {
    expect(deriveMeta("Long Table")).toMatchObject({ baseType: "Long Table", variantIndex: null });
    expect(deriveMeta("Long Table with Benches")).toMatchObject({
      baseType: "Long Table with Benches",
      variantIndex: null,
      descriptor: null,
    });
  });

  it("corrects the doubled-word source name (ratified review/32 §7)", () => {
    // Source file is `Long Table Table with one Bench` (typo); the base type is fixed, the
    // stable key still derives from the raw source name (output files don't rename).
    expect(deriveMeta("Long Table Table with one Bench")).toMatchObject({
      key: "long-table-table-with-one-bench",
      baseType: "Long Table with one Bench",
      variantIndex: null,
      descriptor: null,
    });
  });
});

describe("slugify — stable filesystem-safe keys", () => {
  it("lowercases, maps + to -, collapses separators", () => {
    expect(slugify("Desk+System-1 ALL")).toBe("desk-system-1-all");
    expect(slugify("Meeting Room-2")).toBe("meeting-room-2");
    expect(slugify("Long Table Table with one Bench")).toBe("long-table-table-with-one-bench");
  });
});

describe("extractBase64Png — unwraps the SVG shell (data:img/png)", () => {
  it("decodes the payload after base64, up to the closing quote", () => {
    const payload = Buffer.from("hello-png-bytes");
    const b64 = payload.toString("base64");
    const svg = `<svg width="10" height="6"><image xlink:href="data:img/png;base64,${b64}"/></svg>`;
    const out = extractBase64Png(svg);
    expect(out).not.toBeNull();
    expect(out.equals(payload)).toBe(true);
  });

  it("returns null when there's no payload", () => {
    expect(extractBase64Png("<svg></svg>")).toBeNull();
  });

  it("reads the intrinsic svg dims", () => {
    expect(extractSvgDims('<svg width="1382" height="98" viewBox="0 0 1382 98">')).toEqual({
      width: 1382,
      height: 98,
    });
  });
});

describe("defaultFootprint", () => {
  it("is a normalized bottom band", () => {
    expect(defaultFootprint()).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });
});
