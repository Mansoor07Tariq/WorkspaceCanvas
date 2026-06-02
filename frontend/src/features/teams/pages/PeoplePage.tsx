import { useState } from "react";
import { Alert, Card, CardContent, Container, Snackbar, Typography } from "@mui/material";
import { WorkspacesOutlined } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { canManageWorkspaceContent } from "@/features/organizations/utils/membershipUtils";
import { useSelectedOrganization } from "@/features/organizations/context/SelectedOrganizationProvider";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useInvitations } from "../hooks/useInvitations";
import { MembersList } from "../components/MembersList";
import { InviteMemberForm } from "../components/InviteMemberForm";
import { PendingInvitationsList } from "../components/PendingInvitationsList";
import type { CreateInvitationPayload } from "../types/teams.types";
import { ROUTES } from "@/routes/paths";
import { EmptyState } from "@/components/ui/EmptyState";
import { en } from "@/i18n/en";

const c = en.app.people;

export function PeoplePage() {
  return <PeopleContent />;
}

function PeopleContent() {
  const navigate = useNavigate();
  // PR 055: People is scoped to the selected organization.
  const { selectedMembership: membership } = useSelectedOrganization();
  const orgId = membership?.organization_id ?? null;
  const isManager = canManageWorkspaceContent(membership?.role);

  const { members, loading: membersLoading, error: membersError } = useTeamMembers(orgId);
  const {
    invitations,
    loading: invitationsLoading,
    creating,
    createError,
    resendingId,
    createInvite,
    cancelInvite,
    resendInvite,
  } = useInvitations(isManager ? orgId : null);

  const [feedback, setFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  async function handleInvite(payload: CreateInvitationPayload): Promise<boolean> {
    const result = await createInvite(payload);
    return result !== null;
  }

  async function handleResend(invitationId: number): Promise<void> {
    const target = invitations.find((i) => i.id === invitationId);
    try {
      await resendInvite(invitationId);
      setFeedback({
        severity: "success",
        message: c.resendSuccess.replace("{email}", target?.email ?? ""),
      });
    } catch {
      setFeedback({ severity: "error", message: c.resendError });
    }
  }

  if (!membership) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <EmptyState
          icon={<WorkspacesOutlined color="primary" />}
          title={c.noOrg}
          description={c.noOrgDesc}
          actionLabel={en.app.dashboard.createOrgAction}
          onAction={() => navigate(ROUTES.app)}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {c.pageTitle}
      </Typography>

      {isManager && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <InviteMemberForm onSubmit={handleInvite} loading={creating} error={createError} />
          </CardContent>
        </Card>
      )}

      {isManager && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              {c.pendingTitle}
            </Typography>
            <PendingInvitationsList
              invitations={invitations}
              loading={invitationsLoading}
              resendingId={resendingId}
              onCancel={(id) => void cancelInvite(id)}
              onResend={(id) => void handleResend(id)}
            />
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            {c.membersTitle}
          </Typography>
          <MembersList members={members} loading={membersLoading} error={membersError} />
        </CardContent>
      </Card>

      <Snackbar
        open={feedback !== null}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback(null)}
            sx={{ width: "100%" }}
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Container>
  );
}
