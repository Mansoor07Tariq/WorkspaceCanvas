import { api } from "@/lib/api/apiClient";
import { invalidateCache } from "@/lib/api/requestCache";
import type {
  CreateLayoutObjectPayload,
  LayoutObject,
  UpdateLayoutObjectPayload,
} from "../types/layoutObject.types";

function baseUrl(officeId: number, floorId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/layout-objects/`;
}

function detailUrl(officeId: number, floorId: number, objectId: number): string {
  return `/api/offices/${officeId}/floors/${floorId}/layout-objects/${objectId}/`;
}

function layoutObjectsKey(officeId: number, floorId: number): string {
  return `layoutObjects:${officeId}:${floorId}`;
}

export function listLayoutObjects(officeId: number, floorId: number): Promise<LayoutObject[]> {
  return api.get<LayoutObject[]>(baseUrl(officeId, floorId));
}

export async function createLayoutObject(
  officeId: number,
  floorId: number,
  data: CreateLayoutObjectPayload
): Promise<LayoutObject> {
  const obj = await api.post<LayoutObject>(baseUrl(officeId, floorId), data);
  // Add/remove changes the count → also bust the org-wide summary.
  invalidateCache(layoutObjectsKey(officeId, floorId));
  invalidateCache("summary:");
  return obj;
}

export async function updateLayoutObject(
  officeId: number,
  floorId: number,
  objectId: number,
  data: UpdateLayoutObjectPayload
): Promise<LayoutObject> {
  const obj = await api.patch<LayoutObject>(detailUrl(officeId, floorId, objectId), data);
  // Move/resize does not change counts, so only the layout-objects list is busted.
  invalidateCache(layoutObjectsKey(officeId, floorId));
  return obj;
}

export async function deleteLayoutObject(
  officeId: number,
  floorId: number,
  objectId: number
): Promise<void> {
  await api.delete<void>(detailUrl(officeId, floorId, objectId));
  invalidateCache(layoutObjectsKey(officeId, floorId));
  invalidateCache("summary:");
}
