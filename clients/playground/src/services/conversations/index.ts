import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Conversation } from "@/state/types";
import { shortUID } from "@pstdio/prompt-utils";

function isEmptyConversation(c?: Conversation) {
  if (!c) return true;

  const items = Array.isArray(c.messages) ? c.messages : [];
  return items.length === 0;
}

export function selectConversation(id: string | undefined) {
  if (!id) return;

  useWorkspaceStore.setState(
    (state) => {
      state.selectedConversationId = id;
    },
    false,
    "conversations/select",
  );
}

/**
 * Create or select a conversation for the currently selected project.
 * - Prefer another empty conversation in the project
 * - If current selection is empty, keep it
 * - Otherwise create a new conversation and select it
 */
export function createConversation() {
  const state = useWorkspaceStore.getState();

  const projectId = state.selectedProjectId || "todo";
  const selectedId = state.selectedConversationId;

  const allIds = Object.keys(state.conversations).filter(
    (id) => (state.conversations[id]?.projectId ?? "todo") === projectId,
  );

  const otherEmpty = allIds.find((id) => id !== selectedId && isEmptyConversation(state.conversations[id]));
  if (otherEmpty) {
    selectConversation(otherEmpty);
    return;
  }

  if (selectedId && isEmptyConversation(state.conversations[selectedId])) {
    selectConversation(selectedId);
    return;
  }

  const id = shortUID();

  const nameBase = "Conversation";
  const number = allIds.length + 1;
  const name = `${nameBase} ${number}`;

  const convo: Conversation = { id, name, messages: [], projectId };

  useWorkspaceStore.setState(
    (draft) => {
      draft.conversations[id] = convo;
      draft.selectedConversationId = id;
    },
    false,
    "conversations/create",
  );
}

/**
 * Select a project and ensure a conversation is selected for it.
 * - Prefer an empty conversation for that project
 * - Otherwise use the first existing one
 * - If none exist, create a new empty one
 */
export function selectProject(projectId: "todo" | "slides") {
  useWorkspaceStore.setState(
    (state) => {
      state.selectedProjectId = projectId;

      const projectIds = Object.keys(state.conversations).filter(
        (id) => (state.conversations[id]?.projectId ?? "todo") === projectId,
      );

      const findEmpty = (id: string) => isEmptyConversation(state.conversations[id]);

      let nextSelected = projectIds.find(findEmpty) || projectIds[0];

      if (!nextSelected) {
        const id = shortUID();
        const number = 1;
        state.conversations[id] = {
          id,
          name: `Conversation ${number}`,
          messages: [],
          projectId,
        };
        nextSelected = id;
      }

      state.selectedConversationId = nextSelected;
    },
    false,
    "project/select",
  );
}
