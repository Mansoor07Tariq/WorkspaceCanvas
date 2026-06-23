/**
 * FloorEditConfirmDialog — confirm switching a published floor back to draft
 * for editing (PR 064). Editing unpublishes, which pauses new bookings.
 */
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { en } from "@/i18n/en";

const w = en.app.layoutObjects.wizard;

interface Props {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FloorEditConfirmDialog({ open, busy, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{w.editConfirmTitle}</DialogTitle>
      <DialogContent>
        <DialogContentText>{w.editConfirmBody}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy} color="inherit">
          {w.editCancel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy}
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          {w.editConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
