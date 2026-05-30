import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import { ErrorAlert } from "@/components/feedback/ErrorAlert";
import type {
  LayoutObjectFieldErrors,
  LayoutObjectFormFields,
  LayoutObjectType,
} from "../types/layoutObject.types";
import {
  LAYOUT_OBJECT_CATEGORIES,
  CATEGORY_LABELS,
  getObjectsByCategory,
} from "../utils/layoutObjectLibrary";

const c = en.app.layoutObjects;
const objectsByCategory = getObjectsByCategory();

interface Props {
  fields: LayoutObjectFormFields;
  fieldErrors: LayoutObjectFieldErrors;
  submissionLoading: boolean;
  submissionError: string | undefined;
  onFieldChange: <K extends keyof LayoutObjectFormFields>(
    key: K,
    value: LayoutObjectFormFields[K]
  ) => void;
  onSubmit: () => void;
}

function NumericField({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      id={id}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={Boolean(error)}
      helperText={error}
      disabled={disabled}
      size="small"
      inputMode="decimal"
      slotProps={{
        formHelperText: error ? { role: "alert" } : {},
      }}
    />
  );
}

export function LayoutObjectCreateForm({
  fields,
  fieldErrors,
  submissionLoading,
  submissionError,
  onFieldChange,
  onSubmit,
}: Props) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
        {c.createFormTitle}
      </Typography>

      <Stack spacing={2}>
        <FormControl size="small" error={Boolean(fieldErrors.object_type)}>
          <InputLabel id="object-type-label">{c.objectTypeLabel}</InputLabel>
          <Select
            labelId="object-type-label"
            id="object-type-select"
            value={fields.object_type}
            label={c.objectTypeLabel}
            disabled={submissionLoading}
            onChange={(e) => onFieldChange("object_type", e.target.value as LayoutObjectType)}
          >
            {LAYOUT_OBJECT_CATEGORIES.map((category) => {
              const defs = objectsByCategory.get(category) ?? [];
              return [
                <MenuItem
                  key={`cat-${category}`}
                  disabled
                  sx={{ fontWeight: 700, fontSize: "0.72rem", opacity: 1 }}
                >
                  {CATEGORY_LABELS[category]}
                </MenuItem>,
                ...defs.map((def) => (
                  <MenuItem key={def.type} value={def.type}>
                    {def.label}
                  </MenuItem>
                )),
              ];
            })}
          </Select>
          {fieldErrors.object_type && (
            <FormHelperText role="alert">{fieldErrors.object_type}</FormHelperText>
          )}
        </FormControl>

        <TextField
          id="layout-label"
          label={c.labelLabel}
          placeholder={c.labelPlaceholder}
          value={fields.label}
          onChange={(e) => onFieldChange("label", e.target.value)}
          error={Boolean(fieldErrors.label)}
          helperText={fieldErrors.label}
          disabled={submissionLoading}
          size="small"
          slotProps={{
            htmlInput: { maxLength: 120 },
            formHelperText: fieldErrors.label ? { role: "alert" } : {},
          }}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <NumericField
            id="layout-x"
            label={c.xLabel}
            value={fields.x}
            error={fieldErrors.x}
            disabled={submissionLoading}
            onChange={(v) => onFieldChange("x", v)}
          />
          <NumericField
            id="layout-y"
            label={c.yLabel}
            value={fields.y}
            error={fieldErrors.y}
            disabled={submissionLoading}
            onChange={(v) => onFieldChange("y", v)}
          />
          <NumericField
            id="layout-width"
            label={c.widthLabel}
            value={fields.width}
            error={fieldErrors.width}
            disabled={submissionLoading}
            onChange={(v) => onFieldChange("width", v)}
          />
          <NumericField
            id="layout-height"
            label={c.heightLabel}
            value={fields.height}
            error={fieldErrors.height}
            disabled={submissionLoading}
            onChange={(v) => onFieldChange("height", v)}
          />
        </Box>

        <NumericField
          id="layout-rotation"
          label={c.rotationLabel}
          value={fields.rotation}
          error={fieldErrors.rotation}
          disabled={submissionLoading}
          onChange={(v) => onFieldChange("rotation", v)}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={fields.is_bookable}
              onChange={(e) => onFieldChange("is_bookable", e.target.checked)}
              disabled={submissionLoading}
              size="small"
            />
          }
          label={c.isBookableLabel}
        />

        {submissionError && <ErrorAlert message={submissionError} />}

        <Button variant="contained" onClick={onSubmit} disabled={submissionLoading} size="small">
          {c.addButton}
        </Button>
      </Stack>
    </Paper>
  );
}
