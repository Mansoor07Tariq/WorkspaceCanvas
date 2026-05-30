import { en } from "@/i18n/en";
import type { FloorFieldErrors, FloorFormFields } from "../types/floor.types";
import type { CreateFloorPayload } from "../types/floor.types";

const c = en.app.floors;

export function validateFloorName(name: string): string | undefined {
  if (!name.trim()) return c.nameRequired;
  return undefined;
}

export function validateFloorLevel(level: string): string | undefined {
  const trimmed = level.trim();
  if (trimmed === "") return undefined;
  if (!/^-?\d+$/.test(trimmed)) return c.levelInvalid;
  return undefined;
}

export function validateFloorStep(step: string, fields: FloorFormFields): FloorFieldErrors {
  const errors: FloorFieldErrors = {};
  if (step === "details") {
    const nameErr = validateFloorName(fields.name);
    if (nameErr) errors.name = nameErr;
    const levelErr = validateFloorLevel(fields.level_number);
    if (levelErr) errors.level_number = levelErr;
  }
  return errors;
}

export function buildFloorPayload(fields: FloorFormFields): CreateFloorPayload {
  const trimmedLevel = fields.level_number.trim();
  return {
    name: fields.name.trim(),
    level_number: trimmedLevel === "" ? 0 : parseInt(trimmedLevel, 10),
  };
}
