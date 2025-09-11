import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Conversation } from "@/state/types";

/**
 * Remove all conversations for a given project and create a fresh empty one.
 * Returns the new conversation id.
 */
export function resetConversationsForProject(projectId: string) {
  const newId = (
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2)
  ) as string;

  const newConvo: Conversation = {
    id: newId,
    name: "Conversation 1",
    messages: [],
    projectId,
  };

  useWorkspaceStore.setState(
    (state) => {
      const next: Record<string, Conversation> = {};

      for (const [key, value] of Object.entries(state.conversations)) {
        if ((value.projectId ?? "todo") !== projectId) next[key] = value as Conversation;
      }

      next[newId] = newConvo;
      state.conversations = next;
    },
    false,
    "conversations/reset",
  );

  return newId;
}
