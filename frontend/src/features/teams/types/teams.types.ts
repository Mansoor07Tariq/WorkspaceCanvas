export type InvitationRole = "member" | "admin";
export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";
export type MemberStatus = "pending" | "active" | "disabled";

export interface TeamMember {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  job_title: string;
  avatar_url: string | null;
  role: InvitationRole | "owner";
  status: MemberStatus;
  created_at: string;
}

export interface Invitation {
  id: number;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  token: string;
  invited_by_email: string | null;
  accepted_by_email: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
}

export interface CreateInvitationPayload {
  email: string;
  role: InvitationRole;
}

export interface InvitationPublic {
  status: InvitationStatus;
  role: InvitationRole;
  organization_name: string;
  organization_slug: string;
  is_expired: boolean;
}
