import { Box, Divider, Stack, Typography } from "@mui/material";
import { en } from "@/i18n/en";
import type { OrgType } from "../../types/organization.types";

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  company: en.app.orgSetup.typeCompany,
  coworking_space: en.app.orgSetup.typeCoworking,
  other: en.app.orgSetup.typeOther,
};

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
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

interface Props {
  name: string;
  organizationType: OrgType;
  allowedDomain: string;
}

const c = en.app.orgSetup;

export function OrgStepReview({ name, organizationType, allowedDomain }: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" fontWeight={700}>
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
          <ReviewRow label={c.reviewNameLabel} value={name} />
          <ReviewRow label={c.reviewTypeLabel} value={ORG_TYPE_LABELS[organizationType]} />
          <ReviewRow
            label={c.reviewDomainLabel}
            value={allowedDomain.trim() || c.reviewDomainNone}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
