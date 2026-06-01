import {
  Box,
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
import { EmptyState } from "@/components/ui/EmptyState";
import { InvitationLinkCopy } from "./InvitationLinkCopy";
import type { Invitation } from "../types/teams.types";

interface Props {
  invitations: Invitation[];
  loading: boolean;
  onCancel: (invitationId: number) => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function PendingInvitationsList({ invitations, loading, onCancel }: Props) {
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
      {invitations.map((inv) => (
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
            <Tooltip title={`Cancel invitation for ${inv.email}`}>
              <IconButton
                size="small"
                color="error"
                onClick={() => onCancel(inv.id)}
                aria-label={`Cancel invitation for ${inv.email}`}
              >
                <CancelOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {inv.invited_by_email && (
            <Typography variant="caption" color="text.disabled">
              Invited by {inv.invited_by_email}
            </Typography>
          )}
          <InvitationLinkCopy token={inv.token} />
        </Box>
      ))}
    </Stack>
  );
}
