import { getConversationStoreState } from "../KasUIProvider";
import type { Conversation } from "../types";

export const getConversation = (conversationId: string | null | undefined): Conversation | undefined => {
  if (!conversationId) return undefined;

  return getConversationStoreState().conversations[conversationId];
};
