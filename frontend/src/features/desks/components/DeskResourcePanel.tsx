import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { en } from "@/i18n/en";
import type { LayoutObject } from "@/features/layoutObjects/types/layoutObject.types";
import { deleteDesk } from "../api/deskApi";
import type { Desk } from "../types/desk.types";
import { getDeskForLayoutObject, isDeskCapableLayoutObject } from "../utils/deskHelpers";
import { DeskBadge } from "./DeskBadge";
import { DeskCreateForm } from "./DeskCreateForm";
import { DeskStatusChip } from "./DeskStatusChip";

const c = en.app.desks;

interface Props {
  selectedObject: LayoutObject | null;
  desks: Desk[];
  officeId: number;
  floorId: number;
  canManageLayout: boolean;
  onDeskCreated: () => void;
  onDeskDeleted: () => void;
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
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
        {value || "—"}
      </Typography>
    </Box>
  );
}

export function DeskResourcePanel({
  selectedObject,
  desks,
  officeId,
  floorId,
  canManageLayout,
  onDeskCreated,
  onDeskDeleted,
}: Props) {
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | undefined>();

  if (selectedObject === null) return null;

  const isCapable = isDeskCapableLayoutObject(selectedObject.object_type);
  const desk = getDeskForLayoutObject(desks, selectedObject.id);

  async function handleDeactivate() {
    if (!desk) return;
    setDeactivating(true);
    setDeactivateError(undefined);
    try {
      await deleteDesk(officeId, floorId, desk.id);
      onDeskDeleted();
    } catch {
      setDeactivateError(c.deactivateError);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }} data-testid="desk-resource-panel">
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {c.panelTitle}
        </Typography>
        {desk && <DeskBadge />}
      </Stack>

      {!isCapable && (
        <Typography variant="body2" color="text.secondary" data-testid="desk-not-capable-message">
          {c.notDeskCapable}
        </Typography>
      )}

      {isCapable && !desk && (
        <>
          {canManageLayout ? (
            <DeskCreateForm
              officeId={officeId}
              floorId={floorId}
              layoutObjectId={selectedObject.id}
              defaultName={selectedObject.label || selectedObject.object_type_display}
              onCreated={onDeskCreated}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" data-testid="desk-no-desk-message">
              {c.noDesk}
            </Typography>
          )}
        </>
      )}

      {isCapable && desk && (
        <Stack spacing={1.25}>
          <DetailRow label={c.nameLabel} value={desk.name} />
          {desk.code && <DetailRow label={c.codeLabel} value={desk.code} />}
          <Box>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
            >
              {c.statusLabel}
            </Typography>
            <Box sx={{ mt: 0.25 }}>
              <DeskStatusChip status={desk.status} />
            </Box>
          </Box>
          {Object.keys(desk.amenities).some((k) => desk.amenities[k]) && (
            <Box>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}
              >
                {c.amenitiesLabel}
              </Typography>
              <Typography variant="body2">
                {Object.entries(desk.amenities)
                  .filter(([, v]) => v)
                  .map(([k]) => k.replace(/_/g, " "))
                  .join(", ")}
              </Typography>
            </Box>
          )}
          {desk.notes && <DetailRow label={c.notesLabel} value={desk.notes} />}

          {canManageLayout && (
            <>
              <Divider />
              {deactivateError && (
                <Alert
                  severity="error"
                  onClose={() => setDeactivateError(undefined)}
                  sx={{ py: 0.5 }}
                >
                  {deactivateError}
                </Alert>
              )}
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={handleDeactivate}
                disabled={deactivating}
                startIcon={
                  deactivating ? <CircularProgress size={14} color="inherit" /> : undefined
                }
                data-testid="desk-deactivate-button"
              >
                {c.deactivateAction}
              </Button>
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}
