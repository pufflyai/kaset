import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { ConversationStoreHydration, ConversationStoreState } from "./types";

const DEFAULT_STATE: ConversationStoreState = {
  conversations: {},
  selectedConversationId: null,
  ui: {},
};

export const createConversationStore = (initial?: Partial<ConversationStoreHydration>) => {
  const baseState: ConversationStoreState = {
    ...DEFAULT_STATE,
    ...initial,
    conversations: initial?.conversations ?? DEFAULT_STATE.conversations,
    selectedConversationId: initial?.selectedConversationId ?? DEFAULT_STATE.selectedConversationId,
    ui: DEFAULT_STATE.ui,
  };

  return create<ConversationStoreState>()(subscribeWithSelector(immer(() => baseState)));
};

export type ConversationStore = ReturnType<typeof createConversationStore>;
