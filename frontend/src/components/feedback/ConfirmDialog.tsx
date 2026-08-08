import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  message: string;
  /** Confirm (destructive) action label. */
  confirmLabel: string;
  /** Dismiss label. */
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Disables the buttons and shows a spinner on confirm while the action runs. */
  loading?: boolean;
  /** Colour the confirm button as a destructive (error) action. */
  destructive?: boolean;
}

/**
 * Small reusable confirmation dialog (PR 070). Used for cancel-booking confirmation on
 * both My Bookings and the booking picker. Behaviour: Esc / backdrop dismiss (disabled
 * while `loading`), confirm runs `onConfirm`. All copy is passed in (i18n by the caller).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  loading = false,
  destructive = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      aria-labelledby="confirm-dialog-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          color={destructive ? "error" : "primary"}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
