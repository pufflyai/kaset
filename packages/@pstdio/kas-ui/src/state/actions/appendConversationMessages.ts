import type { UIMessage } from "../../adapters/kas";
import { getConversationStore } from "../KasUIProvider";

export const appendConversationMessages = (conversationId: string, messages: UIMessage[]) => {
  if (!conversationId || messages.length === 0) return;

  const store = getConversationStore();

  store.setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation) return;

    conversation.messages = [...conversation.messages, ...messages];
  });
};
