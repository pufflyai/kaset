import { useWorkspaceStore } from "../WorkspaceProvider";
import { getDefaultConversationState } from "./getDefaultConversationState";

export const resetWorkspace = () => {
  useWorkspaceStore.setState(
    (state) => {
      const { conversations, selectedConversationId } = getDefaultConversationState();

      state.conversations = conversations;

      if (selectedConversationId) {
        state.selectedConversationId = selectedConversationId;
      }

      state.desktop.windows = [];
    },
    false,
    "workspace/reset",
  );
};
