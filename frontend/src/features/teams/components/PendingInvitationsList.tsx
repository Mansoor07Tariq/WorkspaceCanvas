import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { CancelOutlined } from "@mui/icons-material";
import { MailOutlined } from "@mui/icons-material";
import { SendOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import { InvitationLinkCopy } from "./InvitationLinkCopy";
import { formatInvitationExpiry } from "../utils/invitationExpiry";
import { en } from "@/i18n/en";
import type { Invitation } from "../types/teams.types";

const c = en.app.people;

interface Props {
  invitations: Invitation[];
  loading: boolean;
  resendingId: number | null;
  onCancel: (invitationId: number) => void;
  onResend: (invitationId: number) => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function PendingInvitationsList({
  invitations,
  loading,
  resendingId,
  onCancel,
  onResend,
}: Props) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} aria-label="Loading invitations" />
      </Box>
    );
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={<MailOutlined color="primary" />}
        title="No pending invitations"
        description="Invite people above to share your workspace."
      />
    );
  }

  return (
    <Stack divider={<Divider />} spacing={0}>
      {invitations.map((inv) => {
        const expiry = formatInvitationExpiry(inv.expires_at);
        const isResending = resendingId === inv.id;
        return (
          <Box key={inv.id} sx={{ py: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
                {inv.email}
              </Typography>
              <Chip
                label={ROLE_LABEL[inv.role] ?? inv.role}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
              <Chip
                label={expiry.label}
                size="small"
                color={expiry.expired ? "error" : "default"}
                variant={expiry.expired ? "filled" : "outlined"}
                sx={{ height: 20, fontSize: "0.7rem" }}
              />
              <Button
                size="small"
                variant="text"
                startIcon={
                  isResending ? <CircularProgress size={14} /> : <SendOutlined fontSize="small" />
                }
                onClick={() => onResend(inv.id)}
                disabled={resendingId !== null}
                aria-label={`Resend invitation to ${inv.email}`}
              >
                {isResending ? c.resending : c.resendInvite}
              </Button>
              <Tooltip title={`Cancel invitation for ${inv.email}`}>
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => onCancel(inv.id)}
                    disabled={resendingId !== null}
                    aria-label={`Cancel invitation for ${inv.email}`}
                  >
                    <CancelOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            {inv.invited_by_email && (
              <Typography variant="caption" color="text.disabled">
                Invited by {inv.invited_by_email}
              </Typography>
            )}
            <InvitationLinkCopy token={inv.token} />
          </Box>
        );
      })}
    </Stack>
  );
}
