import { getConversationStore } from "../KasUIProvider";

export const setConversationStreaming = (conversationId: string | null | undefined, streaming: boolean) => {
  if (!conversationId) return;

  const store = getConversationStore();

  store.setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation) return;

    conversation.streaming = streaming;
  });
};
