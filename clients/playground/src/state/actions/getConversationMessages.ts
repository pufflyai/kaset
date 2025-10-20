import type { UIMessage } from "@pstdio/kas/kas-ui";
import { useWorkspaceStore } from "../WorkspaceProvider";

export const getConversationMessages = (conversationId: string | null | undefined): UIMessage[] => {
  if (!conversationId) return [];

  const conversation = useWorkspaceStore.getState().conversations[conversationId];
  return conversation?.messages ?? [];
};
