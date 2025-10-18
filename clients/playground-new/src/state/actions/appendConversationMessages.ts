import type { UIMessage } from "@pstdio/kas/kas-ui";
import { useWorkspaceStore } from "../WorkspaceProvider";

export const appendConversationMessages = (
  conversationId: string,
  messages: UIMessage[],
  actionName = "conversations/append/messages",
) => {
  if (!conversationId || messages.length === 0) return;

  useWorkspaceStore.setState(
    (state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return;

      conversation.messages = [...conversation.messages, ...messages];
    },
    false,
    actionName,
  );
};
