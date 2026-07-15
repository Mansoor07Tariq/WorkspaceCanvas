import type { LayoutObjectType } from "@/features/layoutObjects/types/layoutObject.types";

export type DeskStatus = "available" | "unavailable" | "maintenance";

/**
 * Layout object types that can be linked to a Desk resource. Re-exported from
 * the single source of truth so this type stays in lockstep with the runtime set.
 */
export type { DeskCapableLayoutObjectType } from "@/features/layoutObjects/constants/deskCapableTypes";

export interface DeskAmenities {
  monitor?: boolean;
  docking_station?: boolean;
  standing_desk?: boolean;
  near_window?: boolean;
  [key: string]: boolean | undefined;
}

export interface Desk {
  id: number;
  organization: number;
  office: number;
  floor: number;
  layout_object: number;
  layout_object_type: LayoutObjectType;
  layout_object_label: string;
  name: string;
  code: string;
  status: DeskStatus;
  status_display: string;
  amenities: DeskAmenities;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDeskPayload {
  layout_object: number;
  name: string;
  code?: string;
  status?: DeskStatus;
  amenities?: DeskAmenities;
  notes?: string;
}

export interface UpdateDeskPayload {
  name?: string;
  code?: string;
  status?: DeskStatus;
  amenities?: DeskAmenities;
  notes?: string;
}
