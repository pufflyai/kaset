import { useWorkspaceStore } from "../WorkspaceProvider";
import { getDefaultConversationState } from "./getDefaultConversationState";

export const deleteAllConversations = () => {
  useWorkspaceStore.setState(
    (state) => {
      const { conversations, selectedConversationId } = getDefaultConversationState();

      state.conversations = conversations;

      if (selectedConversationId) {
        state.selectedConversationId = selectedConversationId;
      }
    },
    false,
    "conversations/delete-all",
  );
};
