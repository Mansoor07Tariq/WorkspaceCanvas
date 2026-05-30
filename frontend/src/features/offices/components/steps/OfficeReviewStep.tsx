import { Box, Divider, Stack, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { OfficeFormFields } from "../../types/office.types";

const c = en.app.offices;

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

function buildLocationSummary(fields: OfficeFormFields): string {
  const parts = [
    fields.address_line_1,
    fields.address_line_2,
    fields.city,
    fields.county_or_state,
    fields.country,
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : c.reviewLocationNone;
}

interface Props {
  fields: OfficeFormFields;
}

export function OfficeReviewStep({ fields }: Props) {
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
          <ReviewRow label={c.reviewLocationLabel} value={buildLocationSummary(fields)} />
          <ReviewRow
            label={c.reviewTimezoneLabel}
            value={fields.timezone.trim() || c.reviewTimezoneNone}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
