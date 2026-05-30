export interface Floor {
  id: number;
  office: number;
  name: string;
  slug: string;
  level_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFloorPayload {
  name: string;
  level_number: number;
}

export type FloorCreationStep = "details" | "review";

export const FLOOR_CREATION_STEPS: FloorCreationStep[] = ["details", "review"];

export interface FloorFormFields {
  name: string;
  level_number: string;
}

export interface FloorFieldErrors {
  name?: string;
  level_number?: string;
}
