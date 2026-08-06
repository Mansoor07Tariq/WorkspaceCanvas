/**
 * Pure helper for the Tidy ghost-preview overlay (PR 069).
 *
 * Turns the current plan + suggestion selection into the geometry the canvas needs
 * to draw "ghost" outlines of where each object WOULD move/resize/rotate. It is
 * deterministic and framework-free (no React / Konva / MUI): given the plan, the set
 * of object ids implied by the ticked suggestions, and the live objects, it returns
 * one entry per object that has a VISIBLE change. The selection→objectIds mapping is
 * owned by `useEnhanceTidy` (reused, not duplicated) — this only filters + shapes it.
 */
import type { EnhancePlan, GeomSnapshot } from "../enhance/types";
import type { LayoutObject } from "../types/layoutObject.types";

/** Parsed geometry (numbers) — top-left x/y, size, rotation in degrees. */
export interface GhostGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** One ghost: where an object is now (`before`) and where Tidy would put it (`after`). */
export interface GhostPreview {
  objectId: number;
  before: GhostGeometry;
  after: GhostGeometry;
  /** The object's CENTRE moves (drives the current→target connector line). */
  moved: boolean;
  /** The object's size changes. */
  resized: boolean;
}

function num(s: string | undefined): number {
  const n = parseFloat(s ?? "");
  return Number.isFinite(n) ? n : 0;
}

function geomFromSnapshot(g: GeomSnapshot): GhostGeometry {
  return {
    x: num(g.x),
    y: num(g.y),
    width: num(g.width),
    height: num(g.height),
    rotation: num(g.rotation),
  };
}

function geomFromObject(o: LayoutObject): GhostGeometry {
  return {
    x: num(o.x),
    y: num(o.y),
    width: num(o.width),
    height: num(o.height),
    rotation: num(o.rotation),
  };
}

function centre(g: GhostGeometry): { cx: number; cy: number } {
  return { cx: g.x + g.width / 2, cy: g.y + g.height / 2 };
}

/**
 * @param plan               the computed Tidy plan (or null when none / cleared)
 * @param selectedObjectIds  object ids implied by the currently-ticked suggestions
 * @param objects            the live layout objects (source of the current geometry)
 * @returns one ghost per selected operation that produces a visible change; ops for
 *          missing/stale objects, unselected objects, and no-op geometry are excluded.
 */
export function buildGhostPreview(
  plan: EnhancePlan | null,
  selectedObjectIds: ReadonlySet<number>,
  objects: LayoutObject[]
): GhostPreview[] {
  if (!plan) return [];
  const byId = new Map(objects.map((o) => [o.id, o]));
  const ghosts: GhostPreview[] = [];
  for (const op of plan.operations) {
    if (!selectedObjectIds.has(op.objectId)) continue; // respects suggestion selection
    const live = byId.get(op.objectId);
    if (!live) continue; // object deleted / stale since the plan was computed → skip
    const before = geomFromObject(live);
    const after = geomFromSnapshot(op.after);
    const b = centre(before);
    const a = centre(after);
    const moved = b.cx !== a.cx || b.cy !== a.cy;
    const resized = before.width !== after.width || before.height !== after.height;
    const rotated = before.rotation !== after.rotation;
    if (!moved && !resized && !rotated) continue; // no visible change → no ghost
    ghosts.push({ objectId: op.objectId, before, after, moved, resized });
  }
  return ghosts;
}
