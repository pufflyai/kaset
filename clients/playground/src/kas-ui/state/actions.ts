import { shortUID } from "@pstdio/prompt-utils";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { createDefaultConversationState, ensureConversationSelection } from "./defaults";
import type { ChatSettings, Conversation } from "./types";
import { useConversationStore } from "./KasUIProvider";

export const appendConversationMessages = (conversationId: string, messages: UIMessage[]) => {
  if (!conversationId || messages.length === 0) return;

  useConversationStore.setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation) return state;
    conversation.messages = [...conversation.messages, ...messages];
    return state;
  });
};

export const setConversationMessages = (conversationId: string, messages: UIMessage[]) => {
  if (!conversationId) return;

  useConversationStore.setState((state) => {
    const conversation = state.conversations[conversationId];
    if (!conversation) return state;
    conversation.messages = [...messages];
    return state;
  });
};

export const getConversation = (conversationId: string | null | undefined): Conversation | undefined => {
  if (!conversationId) return undefined;
  return useConversationStore.getState().conversations[conversationId];
};

export const getConversationMessages = (conversationId: string | null | undefined): UIMessage[] => {
  if (!conversationId) return [];
  return useConversationStore.getState().conversations[conversationId]?.messages ?? [];
};

export const getSelectedConversationId = (): string | null => {
  return useConversationStore.getState().selectedConversationId;
};

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

export const selectConversation = (conversationId: string | null | undefined) => {
  if (!conversationId) return;

  useConversationStore.setState((state) => {
    if (!state.conversations[conversationId]) return state;
    state.selectedConversationId = conversationId;
    return state;
  });
};

export const createConversation = () => {
  const state = useConversationStore.getState();
  const normalized = ensureConversationSelection(state);
  const selectedId = normalized.selectedConversationId;
  const conversationIds = Object.keys(normalized.conversations);

  const otherEmpty = conversationIds.find(
    (id) => id !== selectedId && isEmptyConversation(normalized.conversations[id]),
  );
  if (otherEmpty) {
    selectConversation(otherEmpty);
    return;
  }

  if (selectedId && isEmptyConversation(normalized.conversations[selectedId])) {
    selectConversation(selectedId);
    return;
  }

  const id = shortUID();
  const name = buildConversationName(normalized.conversations);

  useConversationStore.setState((draft) => {
    draft.conversations[id] = { id, name, messages: [] };
    draft.selectedConversationId = id;
    return draft;
  });
};

export const deleteAllConversations = () => {
  const defaults = createDefaultConversationState({ conversations: {}, selectedConversationId: null });

  useConversationStore.setState((draft) => {
    draft.conversations = defaults.conversations;
    draft.selectedConversationId = defaults.selectedConversationId;
    return draft;
  });
};

export const updateChatSettings = (settings: Partial<ChatSettings>) => {
  if (!settings || Object.keys(settings).length === 0) return;

  useConversationStore.setState((state) => {
    state.chatSettings = {
      ...state.chatSettings,
      ...settings,
    };
    return state;
  });
};
