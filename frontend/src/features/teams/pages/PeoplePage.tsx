import { Card, CardContent, Container, Typography } from "@mui/material";
import { WorkspacesOutlined } from "@mui/icons-material";
import { AppShell } from "@/app/layout/AppShell";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  canManageWorkspaceContent,
  getFirstActiveMembership,
} from "@/features/organizations/utils/membershipUtils";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { useInvitations } from "../hooks/useInvitations";
import { MembersList } from "../components/MembersList";
import { InviteMemberForm } from "../components/InviteMemberForm";
import { PendingInvitationsList } from "../components/PendingInvitationsList";
import type { CreateInvitationPayload } from "../types/teams.types";
import { ROUTES } from "@/routes/paths";
import { EmptyState } from "@/components/ui/EmptyState";

export function PeoplePage() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logoutUser();
    navigate(ROUTES.login);
  }

  return (
    <AppShell onLogout={() => void handleLogout()}>
      <PeopleContent user={user} />
    </AppShell>
  );
}

interface PeopleContentProps {
  user: import("@/features/auth/types/auth.types").CurrentUser | null;
}

function PeopleContent({ user }: PeopleContentProps) {
  const navigate = useNavigate();
  const membership = getFirstActiveMembership(user);
  const orgId = membership?.organization_id ?? null;
  const isManager = canManageWorkspaceContent(membership?.role);

  const { members, loading: membersLoading, error: membersError } = useTeamMembers(orgId);
  const {
    invitations,
    loading: invitationsLoading,
    creating,
    createError,
    createInvite,
    cancelInvite,
  } = useInvitations(isManager ? orgId : null);

  async function handleInvite(payload: CreateInvitationPayload): Promise<boolean> {
    const result = await createInvite(payload);
    return result !== null;
  }

  if (!membership) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
        <EmptyState
          icon={<WorkspacesOutlined color="primary" />}
          title="No workspace yet"
          description="You are not part of any organization. Create or join one to manage your team."
          actionLabel="Go to Dashboard"
          onAction={() => navigate(ROUTES.app)}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        People
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
              Pending invitations
            </Typography>
            <PendingInvitationsList
              invitations={invitations}
              loading={invitationsLoading}
              onCancel={(id) => void cancelInvite(id)}
            />
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Team members
          </Typography>
          <MembersList members={members} loading={membersLoading} error={membersError} />
        </CardContent>
      </Card>
    </Container>
  );
}
