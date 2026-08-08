/**
 * Remembers the user's last actively-selected office/floor on the booking picker
 * (PR 071), so arriving with no URL params restores it. Stores ONLY the two ids
 * (no personal data), in a namespaced + versioned key, and every storage access is
 * defensive so it degrades to a no-op when localStorage is unavailable.
 */
const STORAGE_KEY = "wc.booking.lastOfficeFloor.v1";

export interface LastOfficeFloor {
  office: number;
  floor: number;
}

/** Parse the stored JSON into a validated pair, or null. Pure — no storage access. */
export function parseLastOfficeFloor(raw: string | null): LastOfficeFloor | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      typeof data === "object" &&
      data !== null &&
      (data as { v?: unknown }).v === 1 &&
      isPositiveInt((data as { office?: unknown }).office) &&
      isPositiveInt((data as { floor?: unknown }).floor)
    ) {
      const d = data as { office: number; floor: number };
      return { office: d.office, floor: d.floor };
    }
  } catch {
    // malformed JSON — treat as absent
  }
  return null;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function loadLastOfficeFloor(): LastOfficeFloor | null {
  try {
    return parseLastOfficeFloor(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage disabled / unavailable
  }
}

export function saveLastOfficeFloor(office: number, floor: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, office, floor }));
  } catch {
    // storage unavailable — best-effort, silently skip
  }
}
