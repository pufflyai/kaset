import { useWorkspaceStore } from "../WorkspaceProvider";
import type { Conversation } from "../types";

export const getConversation = (conversationId: string | null | undefined): Conversation | undefined => {
  if (!conversationId) return undefined;

  return useWorkspaceStore.getState().conversations[conversationId];
};
