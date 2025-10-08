import type { Message } from "@/types";
import { useWorkspaceStore } from "../WorkspaceProvider";

export const getConversationMessages = (conversationId: string | null | undefined): Message[] => {
  if (!conversationId) return [];

  const conversation = useWorkspaceStore.getState().conversations[conversationId];
  return conversation?.messages ?? [];
};
