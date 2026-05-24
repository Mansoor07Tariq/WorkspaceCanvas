import { en } from "@/i18n/en";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function validateAvatarFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) {
    return en.app.profile.carousel.avatarTooLarge;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return en.app.profile.carousel.avatarInvalidType;
  }
  return null;
}
