import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Conversation,
  ConversationStoreHydration,
  ConversationStoreSnapshot,
  ConversationStoreState,
} from "./types";

const DEFAULT_CONVERSATION_ID_VALUE = "default";
const DEFAULT_CONVERSATION_NAME = "Conversation 1";

const buildDefaultConversation = (): Conversation => ({
  id: DEFAULT_CONVERSATION_ID_VALUE,
  name: DEFAULT_CONVERSATION_NAME,
  messages: [],
});

const buildDefaultSnapshot = (): ConversationStoreSnapshot => ({
  conversations: {
    [DEFAULT_CONVERSATION_ID_VALUE]: buildDefaultConversation(),
  },
  selectedConversationId: DEFAULT_CONVERSATION_ID_VALUE,
});

export const getDefaultConversationSnapshot = (): ConversationStoreSnapshot => buildDefaultSnapshot();

export const createConversationStore = (initial?: Partial<ConversationStoreHydration>) => {
  const fallback = getDefaultConversationSnapshot();
  const baseState: ConversationStoreState = {
    conversations: initial?.conversations ?? fallback.conversations,
    selectedConversationId: initial?.selectedConversationId ?? fallback.selectedConversationId,
    ui: {},
  };

  return create<ConversationStoreState>()(
    persist(subscribeWithSelector(immer(() => baseState)), {
      name: "kaset-conversations",
      partialize: (state) => ({
        conversations: state.conversations,
        selectedConversationId: state.selectedConversationId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const hasConversations = Object.keys(state.conversations ?? {}).length > 0;
        if (!hasConversations) {
          const snapshot = getDefaultConversationSnapshot();
          state.conversations = snapshot.conversations;
          state.selectedConversationId = snapshot.selectedConversationId;
          return;
        }

        const selected = state.selectedConversationId;
        if (!selected || !state.conversations[selected]) {
          const [firstId] = Object.keys(state.conversations);
          state.selectedConversationId = firstId ?? null;
        }
      },
    }),
  );
};

export const DEFAULT_CONVERSATION_ID = DEFAULT_CONVERSATION_ID_VALUE;

export type ConversationStore = ReturnType<typeof createConversationStore>;
