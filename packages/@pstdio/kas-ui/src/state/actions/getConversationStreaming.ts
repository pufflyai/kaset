import { getConversationStoreState } from "../KasUIProvider";

export const getConversationStreaming = (conversationId: string | null | undefined): boolean => {
  if (!conversationId) return false;

  const conversation = getConversationStoreState().conversations[conversationId];
  if (!conversation) return false;

  return (conversation as typeof conversation & { streaming?: boolean }).streaming ?? false;
};
