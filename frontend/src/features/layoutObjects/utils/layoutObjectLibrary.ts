import { en } from "@/i18n/en";
import type {
  LayoutObjectCategory,
  LayoutObjectDefinition,
  LayoutObjectType,
} from "../types/layoutObject.types";

const c = en.app.layoutObjects;

export const LAYOUT_OBJECT_CATEGORIES: LayoutObjectCategory[] = [
  "Workstations",
  "Seating",
  "Tables",
  "Rooms & Zones",
  "Structure",
  "Facilities",
  "Decor",
];

export const CATEGORY_LABELS: Record<LayoutObjectCategory, string> = {
  Workstations: c.categoryWorkstations,
  Seating: c.categorySeating,
  Tables: c.categoryTables,
  "Rooms & Zones": c.categoryRoomsZones,
  Structure: c.categoryStructure,
  Facilities: c.categoryFacilities,
  Decor: c.categoryDecor,
};

export const LAYOUT_OBJECT_LIBRARY: LayoutObjectDefinition[] = [
  // Workstations
  {
    type: "desk",
    label: "Desk",
    category: "Workstations",
    defaultSize: { width: 80, height: 50 },
    bookableCandidate: true,
  },
  {
    type: "standing_desk",
    label: "Standing Desk",
    category: "Workstations",
    defaultSize: { width: 80, height: 50 },
    bookableCandidate: true,
  },
  {
    type: "hot_desk",
    label: "Hot Desk",
    category: "Workstations",
    defaultSize: { width: 80, height: 50 },
    bookableCandidate: true,
  },
  {
    type: "private_desk",
    label: "Private Desk",
    category: "Workstations",
    defaultSize: { width: 90, height: 55 },
    bookableCandidate: true,
  },

  // Seating
  {
    type: "chair",
    label: "Chair",
    category: "Seating",
    defaultSize: { width: 35, height: 35 },
    bookableCandidate: false,
  },
  {
    type: "office_chair",
    label: "Office Chair",
    category: "Seating",
    defaultSize: { width: 40, height: 40 },
    bookableCandidate: false,
  },
  {
    type: "meeting_chair",
    label: "Meeting Chair",
    category: "Seating",
    defaultSize: { width: 35, height: 35 },
    bookableCandidate: false,
  },
  {
    type: "lounge_chair",
    label: "Lounge Chair",
    category: "Seating",
    defaultSize: { width: 60, height: 70 },
    bookableCandidate: false,
  },
  {
    type: "bench",
    label: "Bench",
    category: "Seating",
    defaultSize: { width: 120, height: 35 },
    bookableCandidate: false,
  },
  {
    type: "sofa",
    label: "Sofa",
    category: "Seating",
    defaultSize: { width: 120, height: 45 },
    bookableCandidate: false,
  },

  // Tables
  {
    type: "table",
    label: "Table",
    category: "Tables",
    defaultSize: { width: 100, height: 60 },
    bookableCandidate: false,
  },
  {
    type: "lunch_table",
    label: "Lunch Table",
    category: "Tables",
    defaultSize: { width: 120, height: 70 },
    bookableCandidate: false,
  },
  {
    type: "boardroom_table",
    label: "Boardroom Table",
    category: "Tables",
    defaultSize: { width: 180, height: 80 },
    bookableCandidate: false,
  },
  {
    type: "coffee_table",
    label: "Coffee Table",
    category: "Tables",
    defaultSize: { width: 60, height: 40 },
    bookableCandidate: false,
  },

  // Rooms & Zones
  {
    type: "room",
    label: "Room",
    category: "Rooms & Zones",
    defaultSize: { width: 200, height: 150 },
    bookableCandidate: true,
  },
  {
    type: "meeting_room",
    label: "Meeting Room",
    category: "Rooms & Zones",
    defaultSize: { width: 240, height: 180 },
    bookableCandidate: true,
  },
  {
    type: "quiet_room",
    label: "Quiet Room",
    category: "Rooms & Zones",
    defaultSize: { width: 180, height: 150 },
    bookableCandidate: true,
  },
  {
    type: "focus_zone",
    label: "Focus Zone",
    category: "Rooms & Zones",
    defaultSize: { width: 200, height: 150 },
    bookableCandidate: true,
  },
  {
    type: "phone_booth",
    label: "Phone Booth",
    category: "Rooms & Zones",
    defaultSize: { width: 90, height: 90 },
    bookableCandidate: true,
  },
  {
    type: "meeting_pod",
    label: "Meeting Pod",
    category: "Rooms & Zones",
    defaultSize: { width: 140, height: 120 },
    bookableCandidate: true,
  },

  // Structure
  {
    type: "wall",
    label: "Wall",
    category: "Structure",
    defaultSize: { width: 200, height: 10 },
    bookableCandidate: false,
  },
  {
    type: "door",
    label: "Door",
    category: "Structure",
    defaultSize: { width: 40, height: 10 },
    bookableCandidate: false,
  },
  {
    type: "window",
    label: "Window",
    category: "Structure",
    defaultSize: { width: 80, height: 8 },
    bookableCandidate: false,
  },
  {
    type: "column",
    label: "Column",
    category: "Structure",
    defaultSize: { width: 20, height: 20 },
    bookableCandidate: false,
  },
  {
    type: "partition",
    label: "Partition",
    category: "Structure",
    defaultSize: { width: 120, height: 10 },
    bookableCandidate: false,
  },
  {
    type: "cutout",
    label: "Cutout",
    category: "Structure",
    defaultSize: { width: 120, height: 100 },
    bookableCandidate: false,
  },

  // Facilities
  {
    type: "toilet",
    label: "Toilet",
    category: "Facilities",
    defaultSize: { width: 45, height: 45 },
    bookableCandidate: false,
  },
  {
    type: "sink",
    label: "Sink",
    category: "Facilities",
    defaultSize: { width: 45, height: 30 },
    bookableCandidate: false,
  },
  {
    type: "kitchen_sink",
    label: "Kitchen Sink",
    category: "Facilities",
    defaultSize: { width: 60, height: 30 },
    bookableCandidate: false,
  },
  {
    type: "cabinet",
    label: "Cabinet",
    category: "Facilities",
    defaultSize: { width: 60, height: 30 },
    bookableCandidate: false,
  },
  {
    type: "locker",
    label: "Locker",
    category: "Facilities",
    defaultSize: { width: 30, height: 50 },
    bookableCandidate: false,
  },
  {
    type: "printer",
    label: "Printer",
    category: "Facilities",
    defaultSize: { width: 50, height: 40 },
    bookableCandidate: false,
  },
  {
    type: "tv",
    label: "TV",
    category: "Facilities",
    defaultSize: { width: 90, height: 15 },
    bookableCandidate: false,
  },
  {
    type: "whiteboard",
    label: "Whiteboard",
    category: "Facilities",
    defaultSize: { width: 120, height: 10 },
    bookableCandidate: false,
  },

  // Decor
  {
    type: "plant",
    label: "Plant",
    category: "Decor",
    defaultSize: { width: 35, height: 35 },
    bookableCandidate: false,
  },
  {
    type: "label",
    label: "Label",
    category: "Decor",
    defaultSize: { width: 80, height: 20 },
    bookableCandidate: false,
  },
  {
    type: "shape",
    label: "Shape",
    category: "Decor",
    defaultSize: { width: 60, height: 60 },
    bookableCandidate: false,
  },
];

const _libraryByType = new Map<LayoutObjectType, LayoutObjectDefinition>(
  LAYOUT_OBJECT_LIBRARY.map((def) => [def.type, def])
);

export function getLayoutObjectDefinition(
  type: LayoutObjectType
): LayoutObjectDefinition | undefined {
  return _libraryByType.get(type);
}

export function getDefaultSizeForObjectType(type: LayoutObjectType): {
  width: number;
  height: number;
} {
  return _libraryByType.get(type)?.defaultSize ?? { width: 80, height: 50 };
}

export function getObjectsByCategory(): Map<LayoutObjectCategory, LayoutObjectDefinition[]> {
  const result = new Map<LayoutObjectCategory, LayoutObjectDefinition[]>();
  for (const category of LAYOUT_OBJECT_CATEGORIES) {
    result.set(category, []);
  }
  for (const def of LAYOUT_OBJECT_LIBRARY) {
    result.get(def.category)!.push(def);
  }
  return result;
}

export const VALID_OBJECT_TYPES: ReadonlySet<LayoutObjectType> = new Set(
  LAYOUT_OBJECT_LIBRARY.map((def) => def.type)
);
