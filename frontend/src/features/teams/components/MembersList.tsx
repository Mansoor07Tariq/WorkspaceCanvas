import { Avatar, Box, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { PeopleOutlined } from "@mui/icons-material";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TeamMember } from "../types/teams.types";

interface Props {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_COLOR: Record<string, "warning" | "info" | "default"> = {
  owner: "warning",
  admin: "info",
  member: "default",
};

export function MembersList({ members, loading, error }: Props) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} aria-label="Loading members" />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" variant="body2" role="alert">
        {error}
      </Typography>
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<PeopleOutlined color="primary" />}
        title="No members yet"
        description="You are the only member of this workspace."
      />
    );
  }

  return (
    <Stack divider={<Divider />} spacing={0}>
      {members.map((member) => (
        <Box key={member.id} sx={{ py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            src={member.avatar_url ?? undefined}
            alt={member.full_name || member.email}
            sx={{ width: 36, height: 36, fontSize: "0.85rem" }}
          >
            {(member.full_name || member.email).charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {member.full_name || member.email}
            </Typography>
            {member.full_name && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {member.email}
              </Typography>
            )}
            {member.job_title && (
              <Typography variant="caption" color="text.disabled" noWrap sx={{ display: "block" }}>
                {member.job_title}
              </Typography>
            )}
          </Box>
          <Chip
            label={ROLE_LABEL[member.role] ?? member.role}
            size="small"
            color={ROLE_COLOR[member.role] ?? "default"}
            variant="outlined"
            sx={{ height: 20, fontSize: "0.7rem", flexShrink: 0 }}
          />
        </Box>
      ))}
    </Stack>
  );
}
