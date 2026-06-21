export type LayoutObjectType =
  | "desk"
  | "standing_desk"
  | "hot_desk"
  | "private_desk"
  | "chair"
  | "office_chair"
  | "meeting_chair"
  | "lounge_chair"
  | "bench"
  | "sofa"
  | "table"
  | "lunch_table"
  | "boardroom_table"
  | "coffee_table"
  | "room"
  | "meeting_room"
  | "quiet_room"
  | "focus_zone"
  | "phone_booth"
  | "meeting_pod"
  | "wall"
  | "door"
  | "window"
  | "column"
  | "partition"
  | "cutout"
  | "toilet"
  | "sink"
  | "kitchen_sink"
  | "cabinet"
  | "locker"
  | "printer"
  | "tv"
  | "whiteboard"
  | "plant"
  | "label"
  | "shape";

export type LayoutObjectCategory =
  | "Workstations"
  | "Seating"
  | "Tables"
  | "Rooms & Zones"
  | "Structure"
  | "Facilities"
  | "Decor";

export interface LayoutObject {
  id: number;
  floor: number;
  object_type: LayoutObjectType;
  object_type_display: string;
  label: string;
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
  is_bookable: boolean;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLayoutObjectPayload {
  object_type: LayoutObjectType;
  label: string;
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
  is_bookable: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateLayoutObjectPayload {
  object_type?: LayoutObjectType;
  label?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  rotation?: string;
  is_bookable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LayoutObjectDefinition {
  type: LayoutObjectType;
  label: string;
  category: LayoutObjectCategory;
  defaultSize: { width: number; height: number };
  bookableCandidate: boolean;
}

export interface LayoutObjectFormFields {
  object_type: LayoutObjectType | "";
  label: string;
  x: string;
  y: string;
  width: string;
  height: string;
  rotation: string;
  is_bookable: boolean;
}

export interface LayoutObjectFieldErrors {
  object_type?: string;
  label?: string;
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  rotation?: string;
}
