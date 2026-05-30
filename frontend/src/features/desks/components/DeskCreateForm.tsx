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
import { createDesk } from "../api/deskApi";
import type { DeskAmenities, DeskStatus } from "../types/desk.types";

const c = en.app.desks;

const STATUS_OPTIONS: { value: DeskStatus; label: string }[] = [
  { value: "available", label: c.statusAvailable },
  { value: "unavailable", label: c.statusUnavailable },
  { value: "maintenance", label: c.statusMaintenance },
];

const AMENITY_OPTIONS: { key: keyof DeskAmenities; label: string }[] = [
  { key: "monitor", label: c.amenityMonitor },
  { key: "docking_station", label: c.amenityDockingStation },
  { key: "standing_desk", label: c.amenityStandingDesk },
  { key: "near_window", label: c.amenityNearWindow },
];

interface Props {
  officeId: number;
  floorId: number;
  layoutObjectId: number;
  defaultName?: string;
  onCreated: () => void;
}

export function DeskCreateForm({
  officeId,
  floorId,
  layoutObjectId,
  defaultName = "",
  onCreated,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<DeskStatus>("available");
  const [amenities, setAmenities] = useState<DeskAmenities>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function toggleAmenity(key: keyof DeskAmenities, checked: boolean) {
    setAmenities((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      await createDesk(officeId, floorId, {
        layout_object: layoutObjectId,
        name: name.trim(),
        code: code.trim() || undefined,
        status,
        amenities,
        notes: notes.trim(),
      });
      onCreated();
    } catch {
      setError(c.createError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} data-testid="desk-create-form">
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
          slotProps={{ htmlInput: { "data-testid": "desk-name-input" } }}
        />

        <TextField
          label={c.codeLabel}
          placeholder={c.codePlaceholder}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { "data-testid": "desk-code-input" } }}
        />

        <TextField
          label={c.statusLabel}
          select
          value={status}
          onChange={(e) => setStatus(e.target.value as DeskStatus)}
          size="small"
          fullWidth
          slotProps={{ htmlInput: { "data-testid": "desk-status-select" } }}
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
                        "data-testid": `amenity-${opt.key}`,
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
          slotProps={{ htmlInput: { "data-testid": "desk-notes-input" } }}
        />

        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={loading || !name.trim()}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
          data-testid="desk-create-submit"
        >
          {c.submitCreate}
        </Button>
      </Stack>
    </Box>
  );
}
