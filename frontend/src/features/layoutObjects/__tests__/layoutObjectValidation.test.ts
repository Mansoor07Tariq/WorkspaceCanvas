import { describe, it, expect } from "vitest";
import {
  validateObjectType,
  validateLabel,
  validatePosition,
  validateSize,
  validateRotation,
  validateLayoutObjectFields,
  buildLayoutObjectPayload,
  makeDefaultFields,
} from "../utils/layoutObjectValidation";
import type { LayoutObjectFormFields } from "../types/layoutObject.types";

const baseFields: LayoutObjectFormFields = {
  object_type: "desk",
  label: "Desk A1",
  x: "100",
  y: "150",
  width: "80",
  height: "50",
  rotation: "0",
  is_bookable: false,
};

describe("validateObjectType", () => {
  it("returns error for empty string", () => {
    expect(validateObjectType("")).toBeTruthy();
  });

  it("returns error for invalid type", () => {
    expect(validateObjectType("spaceship")).toBeTruthy();
    expect(validateObjectType("DESK")).toBeTruthy();
  });

  it("returns undefined for valid type", () => {
    expect(validateObjectType("desk")).toBeUndefined();
    expect(validateObjectType("meeting_pod")).toBeUndefined();
    expect(validateObjectType("kitchen_sink")).toBeUndefined();
    expect(validateObjectType("plant")).toBeUndefined();
  });
});

describe("validateLabel", () => {
  it("returns undefined for empty label (optional)", () => {
    expect(validateLabel("")).toBeUndefined();
  });

  it("returns undefined for valid label", () => {
    expect(validateLabel("Desk A1")).toBeUndefined();
  });

  it("returns error for label exceeding 120 chars", () => {
    expect(validateLabel("x".repeat(121))).toBeTruthy();
  });

  it("returns undefined for label at exactly 120 chars", () => {
    expect(validateLabel("x".repeat(120))).toBeUndefined();
  });
});

describe("validatePosition", () => {
  it("returns error for empty string", () => {
    expect(validatePosition("")).toBeTruthy();
  });

  it("returns undefined for 0", () => {
    expect(validatePosition("0")).toBeUndefined();
  });

  it("returns undefined for positive number", () => {
    expect(validatePosition("100")).toBeUndefined();
    expect(validatePosition("100.5")).toBeUndefined();
  });

  it("returns error for non-numeric string", () => {
    expect(validatePosition("abc")).toBeTruthy();
  });

  it("returns undefined for negative number", () => {
    expect(validatePosition("-50")).toBeUndefined();
  });
});

describe("validateSize", () => {
  it("returns error for empty string", () => {
    expect(validateSize("")).toBeTruthy();
  });

  it("returns error for zero", () => {
    expect(validateSize("0")).toBeTruthy();
  });

  it("returns error for negative value", () => {
    expect(validateSize("-10")).toBeTruthy();
  });

  it("returns error for non-numeric string", () => {
    expect(validateSize("abc")).toBeTruthy();
  });

  it("returns undefined for positive value", () => {
    expect(validateSize("80")).toBeUndefined();
    expect(validateSize("0.1")).toBeUndefined();
  });
});

describe("validateRotation", () => {
  it("returns undefined for empty string (optional)", () => {
    expect(validateRotation("")).toBeUndefined();
  });

  it("returns undefined for 0", () => {
    expect(validateRotation("0")).toBeUndefined();
  });

  it("returns undefined for 45", () => {
    expect(validateRotation("45")).toBeUndefined();
  });

  it("returns error for non-numeric string", () => {
    expect(validateRotation("abc")).toBeTruthy();
  });
});

describe("validateLayoutObjectFields", () => {
  it("returns no errors for valid fields", () => {
    const errors = validateLayoutObjectFields(baseFields);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("returns error when object_type is empty", () => {
    const errors = validateLayoutObjectFields({ ...baseFields, object_type: "" });
    expect(errors.object_type).toBeTruthy();
  });

  it("returns errors for missing position and size", () => {
    const errors = validateLayoutObjectFields({
      ...baseFields,
      x: "",
      y: "",
      width: "",
      height: "",
    });
    expect(errors.x).toBeTruthy();
    expect(errors.y).toBeTruthy();
    expect(errors.width).toBeTruthy();
    expect(errors.height).toBeTruthy();
  });
});

describe("buildLayoutObjectPayload", () => {
  it("trims label whitespace", () => {
    const payload = buildLayoutObjectPayload({ ...baseFields, label: "  Desk A1  " });
    expect(payload.label).toBe("Desk A1");
  });

  it("uses 0.00 rotation for empty rotation", () => {
    const payload = buildLayoutObjectPayload({ ...baseFields, rotation: "" });
    expect(payload.rotation).toBe("0.00");
  });

  it("includes correct object_type", () => {
    const payload = buildLayoutObjectPayload(baseFields);
    expect(payload.object_type).toBe("desk");
  });

  it("does not include office_id or floor_id", () => {
    const payload = buildLayoutObjectPayload(baseFields) as unknown as Record<string, unknown>;
    expect("office_id" in payload).toBe(false);
    expect("floor_id" in payload).toBe(false);
  });

  it("sets is_bookable from fields", () => {
    const payload = buildLayoutObjectPayload({ ...baseFields, is_bookable: true });
    expect(payload.is_bookable).toBe(true);
  });
});

describe("makeDefaultFields", () => {
  it("returns empty object_type when no type provided", () => {
    const fields = makeDefaultFields();
    expect(fields.object_type).toBe("");
  });

  it("returns correct default size for desk", () => {
    const fields = makeDefaultFields("desk");
    expect(fields.width).toBe("80");
    expect(fields.height).toBe("50");
  });

  it("returns correct default size for wall", () => {
    const fields = makeDefaultFields("wall");
    expect(fields.width).toBe("200");
    expect(fields.height).toBe("10");
  });

  it("sets rotation to 0 by default", () => {
    const fields = makeDefaultFields("desk");
    expect(fields.rotation).toBe("0");
  });

  it("sets is_bookable to false by default", () => {
    const fields = makeDefaultFields("desk");
    expect(fields.is_bookable).toBe(false);
  });
});
