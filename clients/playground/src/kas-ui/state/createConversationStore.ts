import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { createDefaultConversationState, ensureConversationSelection } from "./defaults";
import type { BoundConversationStore, ConversationState, ConversationStore } from "./types";

const DEFAULT_STATE: ConversationState = {
  conversations: {},
  selectedConversationId: null,
  chatSettings: {
    modelId: null,
    apiKey: undefined,
    baseUrl: undefined,
    approvalGatedTools: [],
    credentialsReady: false,
    modelPricing: undefined,
    onOpenSettings: undefined,
  },
};

export const createConversationStore = (initialState: Partial<ConversationState> = {}): BoundConversationStore => {
  const defaults = createDefaultConversationState(DEFAULT_STATE);
  const merged: ConversationState = ensureConversationSelection({
    ...defaults,
    ...initialState,
    chatSettings: {
      ...DEFAULT_STATE.chatSettings,
      ...initialState.chatSettings,
    },
  });

  return create<ConversationStore>()(
    persist(
      subscribeWithSelector(
        immer(() => ({
          conversations: merged.conversations,
          selectedConversationId: merged.selectedConversationId,
          chatSettings: merged.chatSettings,
        })),
      ),
      {
        name: "kaset-kas-ui-conversations",
        partialize: (state) => ({
          conversations: state.conversations,
          selectedConversationId: state.selectedConversationId,
        }),
        merge: (persisted, current) => {
          const next: ConversationState = ensureConversationSelection({
            ...current,
            ...(persisted as Partial<ConversationState>),
            chatSettings: current.chatSettings,
          });

          return next;
        },
      },
    ),
  );
};
