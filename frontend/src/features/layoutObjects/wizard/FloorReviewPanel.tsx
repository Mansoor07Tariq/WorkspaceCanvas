/**
 * FloorReviewPanel — the wizard's Review step side panel (PR 064): shows the
 * floor's publish status and the Publish / Edit action.
 */
import { Box, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { CheckCircleOutlined, EditOutlined, PublishOutlined } from "@mui/icons-material";
import { en } from "@/i18n/en";
import type { FloorStatus } from "@/features/floors/types/floor.types";

const w = en.app.layoutObjects.wizard;

interface Props {
  status: FloorStatus;
  busy: boolean;
  onPublish: () => void;
  onEdit: () => void;
}

export function FloorReviewPanel({ status, busy, onPublish, onEdit }: Props) {
  const published = status === "published";
  return (
    <Box data-testid="floor-review-panel" sx={{ p: 1.5 }}>
      <Stack spacing={1.5}>
        <Chip
          icon={published ? <CheckCircleOutlined /> : undefined}
          color={published ? "success" : "default"}
          variant={published ? "filled" : "outlined"}
          label={published ? w.published : w.draft}
          sx={{ alignSelf: "flex-start" }}
        />
        <Typography variant="body2" color="text.secondary">
          {published ? w.publishedHint : w.reviewIntro}
        </Typography>
        {published ? (
          <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={16} /> : <EditOutlined />}
            disabled={busy}
            onClick={onEdit}
          >
            {w.editFloor}
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} /> : <PublishOutlined />}
            disabled={busy}
            onClick={onPublish}
          >
            {busy ? w.publishing : w.publish}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
