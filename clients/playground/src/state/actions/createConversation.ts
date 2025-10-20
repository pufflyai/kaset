import { shortUID } from "@pstdio/prompt-utils";
import { useWorkspaceStore } from "../WorkspaceProvider";
import type { Conversation } from "../types";
import { selectConversation } from "./selectConversation";

const isEmptyConversation = (conversation?: Conversation) => {
  if (!conversation) return true;

  const items = Array.isArray(conversation.messages) ? conversation.messages : [];
  return items.length === 0;
};

const toConversationNumber = (name?: string) => {
  if (!name) return null;

  const match = /^Conversation (\d+)$/.exec(name);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
};

const buildConversationName = (conversations: Record<string, Conversation>) => {
  const numbers = Object.values(conversations)
    .map((conversation) => toConversationNumber(conversation?.name))
    .filter((value): value is number => typeof value === "number");

  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : Object.keys(conversations).length + 1;

  return `Conversation ${nextNumber}`;
};

export const createConversation = () => {
  const state = useWorkspaceStore.getState();
  const selectedId = state.selectedConversationId;
  const conversationIds = Object.keys(state.conversations);

  const otherEmpty = conversationIds.find((id) => id !== selectedId && isEmptyConversation(state.conversations[id]));
  if (otherEmpty) {
    selectConversation(otherEmpty);
    return;
  }

  if (selectedId && isEmptyConversation(state.conversations[selectedId])) {
    selectConversation(selectedId);
    return;
  }

  const id = shortUID();
  const name = buildConversationName(state.conversations);

  useWorkspaceStore.setState(
    (draft) => {
      draft.conversations[id] = { id, name, messages: [] };
      draft.selectedConversationId = id;
    },
    false,
    "conversations/create",
  );
};
