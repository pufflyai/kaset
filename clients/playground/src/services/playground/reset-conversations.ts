import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Conversation } from "@/state/types";
import { shortUID } from "@pstdio/prompt-utils";

/**
 * Remove all conversations for a given project and create a fresh empty one.
 * Returns the new conversation id.
 */
export function resetConversationsForProject(projectId: string) {
  const newId = shortUID();

  const newConvo: Conversation = {
    id: newId,
    name: "Conversation 1",
    messages: [],
    projectId,
  };

  useWorkspaceStore.setState(
    (state) => {
      const wasSelectedFromProject = state.conversations[state.selectedConversationId]?.projectId === projectId;

      const next: Record<string, Conversation> = {};
      for (const [key, value] of Object.entries(state.conversations)) {
        if ((value.projectId ?? "todo") !== projectId) next[key] = value as Conversation;
      }

      next[newId] = newConvo;
      state.conversations = next;

      if (state.selectedProjectId === (projectId as any) || wasSelectedFromProject) {
        state.selectedConversationId = newId;
      }
    },
    false,
    "conversations/reset",
  );

  return newId;
}
