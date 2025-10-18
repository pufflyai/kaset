import type { UIMessage } from "@pstdio/kas/kas-ui";
import { useWorkspaceStore } from "../WorkspaceProvider";

export const setConversationMessages = (
  conversationId: string,
  messages: UIMessage[],
  actionName = "conversations/set/messages",
) => {
  if (!conversationId) return;

  useWorkspaceStore.setState(
    (state) => {
      const conversation = state.conversations[conversationId];
      if (!conversation) return;
      conversation.messages = [...messages];
    },
    false,
    actionName,
  );
};
