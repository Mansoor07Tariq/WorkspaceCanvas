import { Grid, Stack, Typography, FormHelperText } from "@mui/material";
import { FormTextField } from "@/components/ui/FormTextField";
import { en } from "@/i18n/en";

interface Props {
  address_line_1: string;
  address_line_2: string;
  city: string;
  county_or_state: string;
  country: string;
  timezone: string;
  timezoneError?: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

const c = en.app.offices;

export function OfficeLocationStep({
  address_line_1,
  address_line_2,
  city,
  county_or_state,
  country,
  timezone,
  timezoneError,
  onChange,
  disabled,
}: Props) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.75}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {c.stepLocationTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {c.stepLocationSubtitle}
        </Typography>
      </Stack>
      <Stack spacing={2}>
        <FormTextField
          id="address-line-1"
          label={c.addressLine1Label}
          placeholder={c.addressLine1Placeholder}
          value={address_line_1}
          onChange={(e) => onChange("address_line_1", e.target.value)}
          disabled={disabled}
          maxLength={255}
        />
        <FormTextField
          id="address-line-2"
          label={c.addressLine2Label}
          placeholder={c.addressLine2Placeholder}
          value={address_line_2}
          onChange={(e) => onChange("address_line_2", e.target.value)}
          disabled={disabled}
          maxLength={255}
        />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              id="city"
              label={c.cityLabel}
              placeholder={c.cityPlaceholder}
              value={city}
              onChange={(e) => onChange("city", e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              id="county-or-state"
              label={c.countyOrStateLabel}
              placeholder={c.countyOrStatePlaceholder}
              value={county_or_state}
              onChange={(e) => onChange("county_or_state", e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
          </Grid>
        </Grid>
        <FormTextField
          id="country"
          label={c.countryLabel}
          placeholder={c.countryPlaceholder}
          value={country}
          onChange={(e) => onChange("country", e.target.value)}
          disabled={disabled}
          maxLength={120}
        />
        <Stack spacing={0.5}>
          <FormTextField
            id="timezone"
            label={c.timezoneLabel}
            placeholder={c.timezonePlaceholder}
            value={timezone}
            onChange={(e) => onChange("timezone", e.target.value)}
            error={timezoneError}
            disabled={disabled}
            maxLength={64}
          />
          {!timezoneError && <FormHelperText sx={{ mx: 1.75 }}>{c.timezoneHelper}</FormHelperText>}
        </Stack>
      </Stack>
    </Stack>
  );
}
