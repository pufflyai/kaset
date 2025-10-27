import { getConversationStore } from "../KasUIProvider";

export const selectConversation = (conversationId: string | null | undefined) => {
  if (!conversationId) return;

  const store = getConversationStore();
  const conversation = store.getState().conversations[conversationId];
  if (!conversation) return;

  store.setState((state) => {
    state.selectedConversationId = conversationId;
  });
};
