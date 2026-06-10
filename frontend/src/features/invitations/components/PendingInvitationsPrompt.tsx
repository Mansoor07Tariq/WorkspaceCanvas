import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { GroupAddOutlined } from "@mui/icons-material";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { acceptInvitation } from "@/features/teams/api/teamsApi";
import type { PendingInvitation } from "@/features/teams/types/teams.types";
import {
  findActiveMembershipBySlug,
  getAcceptErrorMessage,
  invalidateOrgScopedCaches,
} from "@/features/invitations/lib/acceptInvitationFlow";
import { clearPendingInviteToken } from "@/features/invitations/lib/pendingInviteToken";
import { usePendingInvitations } from "@/features/invitations/hooks/usePendingInvitations";

const DISMISS_KEY = "wc.pendingInvitesDismissed";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function isDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
}

/**
 * Auto-surfaces an accept prompt for any pending invitations addressed to the
 * signed-in user. Rendered on the dashboard (after onboarding / on login) so a
 * user whose invite link state was lost across signup → verify → login still
 * lands inside the invited organization instead of the no-workspace flow.
 *
 * Accepting reuses the shared post-accept flow: invalidate org-scoped caches,
 * refresh the authenticated user, then select the joined org once it becomes
 * visible. Dismissal is remembered for the session so the modal is not nagging.
 */
export function PendingInvitationsPrompt() {
  const { user, refreshUser } = useAuth();
  const { setSelectedOrganizationId } = useSelectedOrganization();
  // Derive enabled from `user`, not auth status: refreshUser() transiently flips
  // status to "loading" (while keeping `user`), and gating on status would reset
  // and refetch the pending list mid-accept — a visible flicker and wasted call.
  const authenticated = !!user;

  const { invitations, loading, remove } = usePendingInvitations(authenticated);

  const [dismissed, setDismissed] = useState(isDismissed);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Slug of the org just joined; once the refreshed user shows the membership we
  // select it (so a multi-org user lands inside the org they just joined).
  const [justJoinedSlug, setJustJoinedSlug] = useState<string | null>(null);
  // Select each joined org at most once: a ref (not setState) keeps the effect
  // lint-clean AND prevents an unrelated later refreshUser from yanking the user
  // back to the joined org after they manually switched the org switcher.
  const selectedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (!justJoinedSlug || selectedSlugRef.current === justJoinedSlug) return;
    const joined = findActiveMembershipBySlug(user, justJoinedSlug);
    if (joined) {
      selectedSlugRef.current = justJoinedSlug;
      setSelectedOrganizationId(joined.organization_id);
    }
  }, [justJoinedSlug, user, setSelectedOrganizationId]);

  const open = authenticated && !dismissed && !loading && invitations.length > 0;
  if (!open) return null;

  async function handleAccept(invitation: PendingInvitation) {
    setAcceptingToken(invitation.token);
    setError(null);
    try {
      await acceptInvitation(invitation.token);
      invalidateOrgScopedCaches();
      await refreshUser();
      clearPendingInviteToken();
      remove(invitation.token);
      setJustJoinedSlug(invitation.organization_slug);
    } catch (err: unknown) {
      setError(getAcceptErrorMessage(err));
    } finally {
      setAcceptingToken(null);
    }
  }

  function handleDismiss() {
    markDismissed();
    setDismissed(true);
  }

  const multiple = invitations.length > 1;

  return (
    <Dialog
      open
      onClose={handleDismiss}
      maxWidth="xs"
      fullWidth
      aria-labelledby="pending-invites-title"
    >
      <DialogTitle
        id="pending-invites-title"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <GroupAddOutlined color="primary" />
        {multiple ? "You have pending invitations" : "You have a pending invitation"}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {multiple
            ? "You've been invited to join these organizations. Accept to get started."
            : "You've been invited to join the organization below. Accept to get started."}
        </DialogContentText>

        {error && (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={1.5}>
          {invitations.map((invitation) => (
            <Box
              key={invitation.token}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>
                  {invitation.organization_name}
                </Typography>
                <Chip
                  size="small"
                  label={ROLE_LABEL[invitation.role] ?? invitation.role}
                  sx={{ mt: 0.5 }}
                />
              </Box>
              <Button
                variant="contained"
                size="small"
                onClick={() => void handleAccept(invitation)}
                disabled={acceptingToken !== null}
              >
                {acceptingToken === invitation.token ? "Joining…" : "Accept"}
              </Button>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} disabled={acceptingToken !== null} color="inherit">
          Maybe later
        </Button>
      </DialogActions>
    </Dialog>
  );
}
