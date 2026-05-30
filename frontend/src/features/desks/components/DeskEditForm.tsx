import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import { ApiError } from "@/lib/api/apiClient";
import { updateDesk } from "../api/deskApi";
import type { Desk, DeskAmenities, DeskStatus } from "../types/desk.types";
import { AMENITY_OPTIONS, STATUS_OPTIONS } from "../utils/deskFormConstants";

const c = en.app.desks;

interface Props {
  desk: Desk;
  officeId: number;
  floorId: number;
  onSaved: () => void;
  onCancel: () => void;
}

export function DeskEditForm({ desk, officeId, floorId, onSaved, onCancel }: Props) {
  const [name, setName] = useState(desk.name);
  const [code, setCode] = useState(desk.code);
  const [status, setStatus] = useState<DeskStatus>(desk.status);
  const [amenities, setAmenities] = useState<DeskAmenities>(desk.amenities);
  const [notes, setNotes] = useState(desk.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function toggleAmenity(key: keyof DeskAmenities, checked: boolean) {
    setAmenities((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(undefined);
    try {
      await updateDesk(officeId, floorId, desk.id, {
        name: name.trim(),
        code: code.trim(),
        status,
        amenities,
        notes: notes.trim(),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(c.editErrorPermission);
      } else if (err instanceof ApiError && err.status === 400) {
        const data = err.data as { code?: string[] } | null;
        const codeMsg = data?.code?.[0];
        setError(codeMsg ?? c.editError);
      } else {
        setError(c.editError);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} data-testid="desk-edit-form">
      <Stack spacing={1.5}>
        {error && (
          <Alert severity="error" onClose={() => setError(undefined)}>
            {error}
          </Alert>
        )}

        <TextField
          label={c.nameLabel}
          placeholder={c.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          required
          fullWidth
          slotProps={{ htmlInput: { "data-testid": "desk-edit-name-input" } }}
        />

        <TextField
          label={c.codeLabel}
          placeholder={c.codePlaceholder}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { "data-testid": "desk-edit-code-input" } }}
        />

        <TextField
          label={c.statusLabel}
          select
          value={status}
          onChange={(e) => setStatus(e.target.value as DeskStatus)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { "data-testid": "desk-edit-status-select" } }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <Typography variant="caption" color="text.secondary">
            {c.amenitiesLabel}
          </Typography>
          <FormGroup row>
            {AMENITY_OPTIONS.map((opt) => (
              <FormControlLabel
                key={opt.key}
                control={
                  <Checkbox
                    size="small"
                    checked={!!amenities[opt.key]}
                    onChange={(e) => toggleAmenity(opt.key, e.target.checked)}
                    slotProps={{
                      input: {
                        "data-testid": `desk-edit-amenity-${opt.key}`,
                      } as React.InputHTMLAttributes<HTMLInputElement>,
                    }}
                  />
                }
                label={<Typography variant="caption">{opt.label}</Typography>}
                sx={{ mr: 1 }}
              />
            ))}
          </FormGroup>
        </Box>

        <TextField
          label={c.notesLabel}
          placeholder={c.notesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          size="small"
          fullWidth
          multiline
          rows={2}
          slotProps={{ htmlInput: { "data-testid": "desk-edit-notes-input" } }}
        />

        <Stack direction="row" spacing={1}>
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={saving || !name.trim()}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
            data-testid="desk-edit-submit"
          >
            {c.submitEdit}
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="small"
            disabled={saving}
            onClick={onCancel}
            data-testid="desk-edit-cancel"
          >
            {c.cancelEdit}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
