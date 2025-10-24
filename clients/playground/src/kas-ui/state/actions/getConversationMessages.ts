import type { UIMessage } from "@pstdio/kas/kas-ui";
import { getConversationStoreState } from "../KasUIProvider";

export const getConversationMessages = (conversationId: string | null | undefined): UIMessage[] => {
  if (!conversationId) return [];

  const conversation = getConversationStoreState().conversations[conversationId];
  return conversation?.messages ?? [];
};
