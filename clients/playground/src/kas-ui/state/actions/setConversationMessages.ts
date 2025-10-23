import type { UIMessage } from "@pstdio/kas/kas-ui";
import { getConversationStore } from "../KasUIProvider";

export const setConversationMessages = (
  conversationId: string,
  messages: UIMessage[],
  actionName = "conversations/set/messages",
) => {
  if (!conversationId) return;

  const store = getConversationStore();

  store.setState(
    (state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return;

      conversation.messages = [...messages];
    },
    false,
    actionName,
  );
};
