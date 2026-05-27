import { api } from "@/lib/api/apiClient";
import type { CreateOfficePayload, Office } from "../types/office.types";

export function listOffices(): Promise<Office[]> {
  return api.get<Office[]>("/api/offices/");
}

export function createOffice(data: CreateOfficePayload): Promise<Office> {
  return api.post<Office, CreateOfficePayload>("/api/offices/", data);
}
