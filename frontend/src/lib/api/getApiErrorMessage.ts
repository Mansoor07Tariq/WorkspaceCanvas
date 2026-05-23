import { ApiError } from "./apiError";
import { en } from "../../i18n/en";

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.data === "object" && error.data !== null) {
    const data = error.data as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return String(data.non_field_errors[0]);
    }
  }
  return en.common.somethingWentWrong;
}
