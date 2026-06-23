import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import type { LayoutObject } from "../types/layoutObject.types";

const c = en.app.layoutObjects;

export interface InspectorPatch {
  label: string;
  width: string;
  height: string;
  rotation: string;
}

interface Props {
  object: LayoutObject | null;
  isSaving?: boolean;
  isSaved?: boolean;
  /** When true, label/size/rotation become editable and `onSave` is used. */
  canEdit?: boolean;
  onSave?: (patch: InspectorPatch) => void;
  /** Optional delete action for the selected object (shown when editable). */
  onDelete?: () => void;
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
        {value}
      </Typography>
    </Box>
  );
}

const num = (s: string) => parseFloat(s);
const eqNum = (a: string, b: string) => Number(num(a)) === Number(num(b));

function InspectorEditor({
  object,
  onSave,
  onDelete,
}: {
  object: LayoutObject;
  onSave: (patch: InspectorPatch) => void;
  onDelete?: () => void;
}) {
  // Fields initialise from the object; the parent remounts this editor (via key)
  // when the object changes externally — selection or a canvas drag/resize — so
  // we never need an effect to re-sync.
  const [label, setLabel] = useState(object.label);
  const [width, setWidth] = useState(object.width);
  const [height, setHeight] = useState(object.height);
  const [rotation, setRotation] = useState(object.rotation);

  const sizeValid = num(width) > 0 && num(height) > 0;
  const rotationValid = Number.isFinite(num(rotation));
  const dirty =
    label !== object.label ||
    !eqNum(width, object.width) ||
    !eqNum(height, object.height) ||
    !eqNum(rotation, object.rotation);
  const canSave = dirty && sizeValid && rotationValid;

  return (
    <Stack spacing={1.25}>
      <InspectorRow label={c.inspectorTypeLabel} value={object.object_type_display} />
      <TextField
        label={c.inspectorLabelField}
        placeholder={c.inspectorLabelPlaceholder}
        size="small"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        slotProps={{ htmlInput: { "aria-label": c.inspectorLabelField } }}
      />
      <Stack direction="row" spacing={1}>
        <TextField
          label={c.inspectorWidthField}
          type="number"
          size="small"
          value={width}
          error={num(width) <= 0}
          onChange={(e) => setWidth(e.target.value)}
          slotProps={{ htmlInput: { "aria-label": c.inspectorWidthField, min: 1 } }}
        />
        <TextField
          label={c.inspectorHeightField}
          type="number"
          size="small"
          value={height}
          error={num(height) <= 0}
          onChange={(e) => setHeight(e.target.value)}
          slotProps={{ htmlInput: { "aria-label": c.inspectorHeightField, min: 1 } }}
        />
      </Stack>
      <TextField
        label={c.inspectorRotationField}
        type="number"
        size="small"
        value={rotation}
        onChange={(e) => setRotation(e.target.value)}
        slotProps={{ htmlInput: { "aria-label": c.inspectorRotationField } }}
      />
      {!sizeValid && <Alert severity="error">{c.inspectorInvalidSize}</Alert>}
      <InspectorRow label={c.inspectorPosition} value={`(${object.x}, ${object.y})`} />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          fullWidth
          disabled={!canSave}
          onClick={() => onSave({ label, width, height, rotation })}
        >
          {c.inspectorSave}
        </Button>
        {onDelete && (
          <Button variant="outlined" size="small" color="error" onClick={onDelete}>
            {c.inspectorDelete}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function InspectorReadOnly({ object }: { object: LayoutObject }) {
  return (
    <Stack spacing={1.25}>
      <InspectorRow label={c.inspectorTypeLabel} value={object.object_type_display} />
      <InspectorRow label={c.inspectorLabelField} value={object.label || c.inspectorNoLabel} />
      <Divider />
      <InspectorRow label={c.inspectorPosition} value={`(${object.x}, ${object.y})`} />
      <InspectorRow label={c.inspectorSize} value={`${object.width} × ${object.height}`} />
      <InspectorRow label={c.inspectorRotation} value={`${object.rotation}°`} />
    </Stack>
  );
}

export function LayoutObjectInspector({
  object,
  isSaving = false,
  isSaved = false,
  canEdit = false,
  onSave,
  onDelete,
}: Props) {
  return (
    <Paper variant="outlined" data-testid="object-inspector" sx={{ p: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {c.inspectorTitle}
        </Typography>
        {isSaving && (
          <Chip
            label={c.inspectorSaving}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.7rem" }}
          />
        )}
        {!isSaving && isSaved && (
          <Chip
            label={c.inspectorSaved}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.7rem" }}
          />
        )}
      </Stack>
      {object === null ? (
        <Typography variant="body2" color="text.secondary">
          {c.inspectorEmpty}
        </Typography>
      ) : canEdit && onSave ? (
        <InspectorEditor
          key={`${object.id}:${object.label}:${object.width}:${object.height}:${object.rotation}`}
          object={object}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : (
        <InspectorReadOnly object={object} />
      )}
    </Paper>
  );
}
