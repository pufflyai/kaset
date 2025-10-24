import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ConversationStoreHydration, ConversationStoreState } from "./types";

const DEFAULT_STATE: ConversationStoreState = {
  conversations: {},
  selectedConversationId: null,
  chatSettings: {
    approvalGatedTools: [],
    credentialsReady: false,
  },
  ui: {},
};

export const createConversationStore = (initial?: Partial<ConversationStoreHydration>) => {
  const baseState: ConversationStoreState = {
    ...DEFAULT_STATE,
    ...initial,
    conversations: initial?.conversations ?? DEFAULT_STATE.conversations,
    selectedConversationId: initial?.selectedConversationId ?? DEFAULT_STATE.selectedConversationId,
    chatSettings: {
      ...DEFAULT_STATE.chatSettings,
      ...initial?.chatSettings,
      approvalGatedTools: initial?.chatSettings?.approvalGatedTools ?? [],
    },
    ui: DEFAULT_STATE.ui,
  };

  return create<ConversationStoreState>()(subscribeWithSelector(immer(() => baseState)));
};

export type ConversationStore = ReturnType<typeof createConversationStore>;
