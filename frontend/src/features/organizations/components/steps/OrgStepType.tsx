import {
  Box,
  Stack,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { en } from "@/i18n/en";
import type { OrgType } from "../../types/organization.types";

interface OrgTypeOption {
  value: OrgType;
  label: string;
  description: string;
}

const c = en.app.orgSetup;

const ORG_TYPE_OPTIONS: OrgTypeOption[] = [
  {
    value: "company",
    label: c.typeCompany,
    description: c.typeCompanyDescription,
  },
  {
    value: "coworking_space",
    label: c.typeCoworking,
    description: c.typeCoworkingDescription,
  },
  {
    value: "other",
    label: c.typeOther,
    description: c.typeOtherDescription,
  },
];

interface Props {
  value: OrgType;
  onChange: (value: OrgType) => void;
  disabled?: boolean;
}

export function OrgStepType({ value, onChange, disabled }: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" fontWeight={700}>
          {c.stepTypeTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepTypeSubtitle}
        </Typography>
      </Stack>
      <FormControl component="fieldset" disabled={disabled} sx={{ width: "100%" }}>
        <RadioGroup value={value} onChange={(e) => onChange(e.target.value as OrgType)}>
          <Stack spacing={1.5}>
            {ORG_TYPE_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                onClick={() => !disabled && onChange(opt.value)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: "1.5px solid",
                  borderColor: value === opt.value ? "primary.main" : "divider",
                  bgcolor: (theme) =>
                    value === opt.value
                      ? alpha(theme.palette.primary.main, 0.05)
                      : "background.paper",
                  cursor: disabled ? "default" : "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": disabled
                    ? {}
                    : {
                        borderColor: "primary.main",
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                }}
              >
                <FormControlLabel
                  value={opt.value}
                  control={<Radio size="small" />}
                  label={
                    <Stack spacing={0.25} sx={{ ml: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {opt.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opt.description}
                      </Typography>
                    </Stack>
                  }
                  sx={{ m: 0, alignItems: "flex-start" }}
                />
              </Box>
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>
    </Stack>
  );
}
