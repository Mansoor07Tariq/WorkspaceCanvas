import { api } from "@/lib/api/apiClient";
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

export function listLayoutObjects(officeId: number, floorId: number): Promise<LayoutObject[]> {
  return api.get<LayoutObject[]>(baseUrl(officeId, floorId));
}

export function createLayoutObject(
  officeId: number,
  floorId: number,
  data: CreateLayoutObjectPayload
): Promise<LayoutObject> {
  return api.post<LayoutObject>(baseUrl(officeId, floorId), data);
}

export function updateLayoutObject(
  officeId: number,
  floorId: number,
  objectId: number,
  data: UpdateLayoutObjectPayload
): Promise<LayoutObject> {
  return api.patch<LayoutObject>(detailUrl(officeId, floorId, objectId), data);
}

export function deleteLayoutObject(
  officeId: number,
  floorId: number,
  objectId: number
): Promise<void> {
  return api.delete<void>(detailUrl(officeId, floorId, objectId));
}
