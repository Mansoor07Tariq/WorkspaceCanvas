import { useRef } from "react";
import { Avatar, Box, Button, Stack, Typography } from "@mui/material";
import { PhotoCameraOutlined, DeleteOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import { getAvatarInitials } from "../../utils/avatarFallback";

interface Props {
  fullName: string;
  avatarPreview: string | null;
  avatarError?: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function StepAvatar({
  fullName,
  avatarPreview,
  avatarError,
  onSelect,
  onClear,
  disabled,
}: Props) {
  const c = en.app.profile.carousel;
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file);
    }
    // Reset so re-selecting the same file triggers onChange again
    e.target.value = "";
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {c.stepAvatarTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepAvatarSubtitle}
        </Typography>
      </Stack>

      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={avatarPreview ?? undefined}
          alt={c.avatarPreviewAlt}
          sx={{ width: 100, height: 100, fontSize: 32 }}
        >
          {!avatarPreview && getAvatarInitials(fullName)}
        </Avatar>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhotoCameraOutlined />}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {avatarPreview ? c.avatarChangeLabel : c.avatarUploadLabel}
          </Button>
          {avatarPreview && (
            <Button
              variant="text"
              size="small"
              color="error"
              startIcon={<DeleteOutlined />}
              onClick={onClear}
              disabled={disabled}
            >
              {c.avatarRemoveLabel}
            </Button>
          )}
        </Stack>

        {avatarError && (
          <Typography variant="caption" color="error" role="alert">
            {avatarError}
          </Typography>
        )}
      </Stack>

      <Box
        component="input"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        sx={{ display: "none" }}
        aria-label={c.avatarUploadLabel}
      />
    </Stack>
  );
}
