import { api } from "@/lib/api/apiClient";

export interface ConfirmChatLinkResponse {
  status: string;
  platform: string;
  linked_email: string;
}

/** Confirm a chat-account link (PR 077): binds the logged-in user to the chat
 * identity that generated the one-time `code` shown in their chat DM. */
export function confirmChatLink(token: string): Promise<ConfirmChatLinkResponse> {
  return api.post<ConfirmChatLinkResponse>("/api/chat/links/confirm/", { token });
}
