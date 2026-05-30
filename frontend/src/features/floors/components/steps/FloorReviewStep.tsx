import { Box, Divider, Stack, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { FloorFormFields } from "../../types/floor.types";

const c = en.app.floors;

interface ReviewRowProps {
  label: string;
  value: string;
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, mr: 2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

interface Props {
  fields: FloorFormFields;
}

export function FloorReviewStep({ fields }: Props) {
  const trimmedLevel = fields.level_number.trim();
  const levelDisplay = trimmedLevel === "" ? "0" : trimmedLevel;

  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.stepReviewTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepReviewSubtitle}
        </Typography>
      </Stack>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          p: 2.5,
        }}
      >
        <Stack spacing={1.5} divider={<Divider />}>
          <ReviewRow label={c.reviewNameLabel} value={fields.name.trim() || "—"} />
          <ReviewRow label={c.reviewLevelLabel} value={levelDisplay} />
        </Stack>
      </Box>
    </Stack>
  );
}
