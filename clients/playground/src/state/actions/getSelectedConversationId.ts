import { useWorkspaceStore } from "../WorkspaceProvider";

export const getSelectedConversationId = (): string => {
  return useWorkspaceStore.getState().selectedConversationId;
};
