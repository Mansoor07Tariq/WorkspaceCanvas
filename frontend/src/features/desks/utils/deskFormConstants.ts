import { en } from "@/i18n/en";
import type { DeskAmenities, DeskStatus } from "../types/desk.types";

const c = en.app.desks;

export const STATUS_OPTIONS: { value: DeskStatus; label: string }[] = [
  { value: "available", label: c.statusAvailable },
  { value: "unavailable", label: c.statusUnavailable },
  { value: "maintenance", label: c.statusMaintenance },
];

export const AMENITY_OPTIONS: { key: keyof DeskAmenities; label: string }[] = [
  { key: "monitor", label: c.amenityMonitor },
  { key: "docking_station", label: c.amenityDockingStation },
  { key: "standing_desk", label: c.amenityStandingDesk },
  { key: "near_window", label: c.amenityNearWindow },
];
