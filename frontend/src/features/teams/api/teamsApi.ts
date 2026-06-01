import { api } from "@/lib/api/apiClient";
import type {
  CreateInvitationPayload,
  Invitation,
  InvitationPublic,
  TeamMember,
} from "../types/teams.types";

export function listMembers(orgId: number): Promise<TeamMember[]> {
  return api.get<TeamMember[]>(`/api/accounts/organizations/${orgId}/members/`);
}

export function listInvitations(orgId: number): Promise<Invitation[]> {
  return api.get<Invitation[]>(`/api/accounts/organizations/${orgId}/invitations/`);
}

export function createInvitation(
  orgId: number,
  payload: CreateInvitationPayload
): Promise<Invitation> {
  return api.post<Invitation>(`/api/accounts/organizations/${orgId}/invitations/`, payload);
}

export function cancelInvitation(orgId: number, invitationId: number): Promise<Invitation> {
  return api.post<Invitation>(
    `/api/accounts/organizations/${orgId}/invitations/${invitationId}/cancel/`,
    {}
  );
}

export function getInvitationByToken(token: string): Promise<InvitationPublic> {
  return api.get<InvitationPublic>(`/api/accounts/invitations/${token}/`);
}

export function acceptInvitation(token: string): Promise<TeamMember> {
  return api.post<TeamMember>(`/api/accounts/invitations/${token}/accept/`, {});
}
