import { useWorkspaceStore } from "../WorkspaceProvider";

export const selectConversation = (conversationId: string | null | undefined) => {
  if (!conversationId) return;

  useWorkspaceStore.setState(
    (state) => {
      if (!state.conversations[conversationId]) return;

      state.selectedConversationId = conversationId;
    },
    false,
    "conversations/select",
  );
};
