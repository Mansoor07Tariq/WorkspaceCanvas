/** Setup lifecycle (PR 064): only `published` floors are bookable. */
export type FloorStatus = "draft" | "published";

export interface Floor {
  id: number;
  /** Owning organization id (TD-045: used to resolve per-office UI role). */
  organization: number;
  office: number;
  name: string;
  slug: string;
  level_number: number;
  /** Editable inner room width (canvas px). DRF DecimalField → string. */
  boundary_width: string;
  /** Editable inner room height (canvas px). DRF DecimalField → string. */
  boundary_height: string;
  /** Setup lifecycle status. Draft = being built (not bookable). */
  status: FloorStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFloorPayload {
  name: string;
  level_number: number;
}

export interface UpdateFloorPayload {
  boundary_width?: number;
  boundary_height?: number;
  status?: FloorStatus;
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
