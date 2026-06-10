import { Backdrop, CircularProgress, Stack, Typography } from "@mui/material";

interface Props {
  /** When true the full-screen overlay is shown. */
  open: boolean;
  /** Message shown under the spinner (also used as the status label). */
  message: string;
}

/**
 * PR 057 (Error 3): a controlled, full-screen transition overlay shown briefly
 * after a successful action (e.g. profile completion) so the hand-off to the
 * next screen feels intentional rather than an abrupt jump. Rendered on top of
 * the current view via MUI Backdrop; exposes a `status` role for assistive tech.
 */
export function FullScreenTransition({ open, message }: Props) {
  return (
    <Backdrop
      open={open}
      role="status"
      aria-label={message}
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        color: "#fff",
        backdropFilter: "blur(2px)",
        backgroundColor: "rgba(15, 23, 42, 0.6)",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress color="inherit" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {message}
        </Typography>
      </Stack>
    </Backdrop>
  );
}
