import type { UIMessage } from "../../adapters/kas";
import { getConversationStoreState } from "../KasUIProvider";

export const getConversationMessages = (conversationId: string | null | undefined): UIMessage[] => {
  if (!conversationId) return [];

  const conversation = getConversationStoreState().conversations[conversationId];
  return conversation?.messages ?? [];
};
