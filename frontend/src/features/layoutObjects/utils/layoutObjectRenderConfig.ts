import type { LayoutObjectCategory, LayoutObjectType } from "../types/layoutObject.types";

export type CanvasShape = "rect" | "circle";

export interface RenderConfig {
  category: LayoutObjectCategory;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashPattern: number[];
  opacity: number;
  cornerRadius: number;
  shape: CanvasShape;
  shortCode: string;
}

export const SELECTED_STROKE = "#F59E0B";
export const SELECTED_STROKE_WIDTH = 3;

// ─── Palette ──────────────────────────────────────────────────────────────────

const P = {
  workstations: { fill: "#BFDBFE", stroke: "#2563EB" },
  seating: { fill: "#BBF7D0", stroke: "#16A34A" },
  tables: { fill: "#FDE68A", stroke: "#D97706" },
  rooms: { fill: "#DDD6FE", stroke: "#7C3AED" },
  structure: { fill: "#D1D5DB", stroke: "#4B5563" },
  facilities: { fill: "#A5F3FC", stroke: "#0891B2" },
  decor: { fill: "#FBCFE8", stroke: "#DB2777" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function workstation(shortCode: string): RenderConfig {
  return {
    category: "Workstations",
    ...P.workstations,
    strokeWidth: 1.5,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 3,
    shape: "rect",
    shortCode,
  };
}

function seating(shortCode: string, circle = false): RenderConfig {
  return {
    category: "Seating",
    ...P.seating,
    strokeWidth: 1.5,
    dashPattern: [],
    opacity: 1,
    cornerRadius: circle ? 100 : 8,
    shape: circle ? "circle" : "rect",
    shortCode,
  };
}

function table(shortCode: string): RenderConfig {
  return {
    category: "Tables",
    ...P.tables,
    strokeWidth: 1.5,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 4,
    shape: "rect",
    shortCode,
  };
}

function room(shortCode: string, dashed = true): RenderConfig {
  return {
    category: "Rooms & Zones",
    ...P.rooms,
    strokeWidth: 1.5,
    dashPattern: dashed ? [8, 4] : [],
    opacity: 0.35,
    cornerRadius: 2,
    shape: "rect",
    shortCode,
  };
}

function structure(shortCode: string, dashed = false): RenderConfig {
  return {
    category: "Structure",
    ...P.structure,
    strokeWidth: 2,
    dashPattern: dashed ? [5, 3] : [],
    opacity: 1,
    cornerRadius: 0,
    shape: "rect",
    shortCode,
  };
}

function facility(shortCode: string): RenderConfig {
  return {
    category: "Facilities",
    ...P.facilities,
    strokeWidth: 1.5,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 2,
    shape: "rect",
    shortCode,
  };
}

// ─── Config map ───────────────────────────────────────────────────────────────

const CONFIGS: Record<LayoutObjectType, RenderConfig> = {
  // Workstations
  desk: workstation("DSK"),
  standing_desk: workstation("STD"),
  hot_desk: workstation("HOT"),
  private_desk: workstation("PRV"),

  // Seating
  chair: seating("CHR", true),
  office_chair: seating("OCH", true),
  meeting_chair: seating("MCH", true),
  lounge_chair: seating("LCH", true),
  bench: seating("BEN"),
  sofa: seating("SOF"),

  // Tables
  table: table("TBL"),
  lunch_table: table("LTB"),
  boardroom_table: table("BRD"),
  coffee_table: { ...table("COF"), cornerRadius: 20 },

  // Rooms & Zones
  room: room("RM"),
  meeting_room: room("MTG"),
  quiet_room: room("QT"),
  focus_zone: room("FOC"),
  phone_booth: { ...room("PHN", false), opacity: 0.4, cornerRadius: 6 },
  meeting_pod: { ...room("POD", false), opacity: 0.4, cornerRadius: 8 },

  // Structure
  wall: structure("WLL"),
  door: structure("DR", true),
  window: {
    category: "Structure",
    fill: "#BAE6FD",
    stroke: "#0284C7",
    strokeWidth: 2,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 0,
    shape: "rect",
    shortCode: "WIN",
  },
  column: structure("COL"),
  partition: structure("PRT", true),

  // Facilities
  toilet: facility("WC"),
  sink: facility("SNK"),
  kitchen_sink: facility("KSK"),
  cabinet: facility("CAB"),
  locker: facility("LKR"),
  printer: facility("PRN"),
  tv: facility("TV"),
  whiteboard: facility("WB"),

  // Decor
  plant: {
    category: "Decor",
    ...P.decor,
    strokeWidth: 1.5,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 100,
    shape: "circle",
    shortCode: "PLT",
  },
  label: {
    category: "Decor",
    fill: "transparent",
    stroke: "transparent",
    strokeWidth: 0,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 0,
    shape: "rect",
    shortCode: "LBL",
  },
  shape: {
    category: "Decor",
    fill: "#F3F4F6",
    stroke: "#6B7280",
    strokeWidth: 1,
    dashPattern: [],
    opacity: 1,
    cornerRadius: 2,
    shape: "rect",
    shortCode: "SHP",
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

const FALLBACK_CONFIG: RenderConfig = {
  category: "Decor",
  fill: "#F3F4F6",
  stroke: "#6B7280",
  strokeWidth: 1,
  dashPattern: [],
  opacity: 1,
  cornerRadius: 2,
  shape: "rect",
  shortCode: "???",
};

export function getLayoutObjectRenderConfig(type: LayoutObjectType): RenderConfig {
  return CONFIGS[type] ?? FALLBACK_CONFIG;
}

export const ALL_LAYOUT_OBJECT_TYPES = Object.keys(CONFIGS) as LayoutObjectType[];
