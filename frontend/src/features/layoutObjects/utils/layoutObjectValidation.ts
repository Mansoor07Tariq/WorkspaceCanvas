import { en } from "@/i18n/en";
import type {
  CreateLayoutObjectPayload,
  LayoutObjectFieldErrors,
  LayoutObjectFormFields,
  LayoutObjectType,
} from "../types/layoutObject.types";
import { VALID_OBJECT_TYPES, getDefaultSizeForObjectType } from "./layoutObjectLibrary";

const c = en.app.layoutObjects;

export function validateObjectType(type: string): string | undefined {
  if (!type) return c.objectTypeRequired;
  if (!VALID_OBJECT_TYPES.has(type as LayoutObjectType)) {
    return c.objectTypeRequired;
  }
  return undefined;
}

export function validateLabel(label: string): string | undefined {
  if (label.trim().length > 120) return c.labelMaxLength;
  return undefined;
}

export function validatePosition(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return c.positionRequired;
  if (isNaN(Number(trimmed))) return c.positionInvalid;
  return undefined;
}

export function validateSize(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return c.sizeRequired;
  const num = Number(trimmed);
  if (isNaN(num)) return c.sizeInvalid;
  if (num <= 0) return c.sizePositive;
  return undefined;
}

export function validateRotation(value: string): string | undefined {
  if (value.trim() === "") return undefined;
  if (isNaN(Number(value.trim()))) return c.rotationInvalid;
  return undefined;
}

export function validateLayoutObjectFields(
  fields: LayoutObjectFormFields
): LayoutObjectFieldErrors {
  const errors: LayoutObjectFieldErrors = {};
  const typeErr = validateObjectType(fields.object_type);
  if (typeErr) errors.object_type = typeErr;
  const labelErr = validateLabel(fields.label);
  if (labelErr) errors.label = labelErr;
  const xErr = validatePosition(fields.x);
  if (xErr) errors.x = xErr;
  const yErr = validatePosition(fields.y);
  if (yErr) errors.y = yErr;
  const widthErr = validateSize(fields.width);
  if (widthErr) errors.width = widthErr;
  const heightErr = validateSize(fields.height);
  if (heightErr) errors.height = heightErr;
  const rotErr = validateRotation(fields.rotation);
  if (rotErr) errors.rotation = rotErr;
  return errors;
}

export function buildLayoutObjectPayload(
  fields: LayoutObjectFormFields
): CreateLayoutObjectPayload {
  const rotation = fields.rotation.trim() === "" ? "0.00" : fields.rotation.trim();
  return {
    object_type: fields.object_type as LayoutObjectType,
    label: fields.label.trim(),
    x: fields.x.trim(),
    y: fields.y.trim(),
    width: fields.width.trim(),
    height: fields.height.trim(),
    rotation,
    is_bookable: fields.is_bookable,
  };
}

export function makeDefaultFields(type: LayoutObjectType | "" = ""): LayoutObjectFormFields {
  if (!type) {
    return {
      object_type: "",
      label: "",
      x: "0",
      y: "0",
      width: "80",
      height: "50",
      rotation: "0",
      is_bookable: false,
    };
  }
  const size = getDefaultSizeForObjectType(type);
  return {
    object_type: type,
    label: "",
    x: "0",
    y: "0",
    width: String(size.width),
    height: String(size.height),
    rotation: "0",
    is_bookable: false,
  };
}
