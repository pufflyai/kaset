import { createContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { shallow } from "zustand/shallow";
import { createConversationStore } from "./createConversationStore";
import type { ConversationStore } from "./createConversationStore";
import type { Conversation, ConversationStoreSnapshot, ConversationStoreState } from "./types";

export const ConversationStoreContext = createContext<ConversationStore | null>(null);

export let useConversationStore: ConversationStore;

interface KasUIProviderProps {
  children: ReactNode;
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  onConversationsChange?: (snapshot: ConversationStoreSnapshot) => void;
}

export function KasUIProvider(props: KasUIProviderProps) {
  const { children, conversations, selectedConversationId, onConversationsChange } = props;
  const storeRef = useRef<ConversationStore | null>(null);

  if (!storeRef.current) {
    useConversationStore = createConversationStore({
      conversations,
      selectedConversationId,
    });
    storeRef.current = useConversationStore;
  }

  const store = storeRef.current!;

  useEffect(() => {
    const current = store.getState();
    if (current.conversations === conversations && current.selectedConversationId === selectedConversationId) {
      return;
    }

    store.setState((draft) => {
      draft.conversations = conversations;
      draft.selectedConversationId = selectedConversationId;
    });
  }, [store, conversations, selectedConversationId]);

  useEffect(() => {
    if (!onConversationsChange) return;

    return store.subscribe(
      (state) => ({
        conversations: state.conversations,
        selectedConversationId: state.selectedConversationId,
      }),
      (snapshot: ConversationStoreSnapshot) => {
        onConversationsChange(snapshot);
      },
      { equalityFn: shallow },
    );
  }, [store, onConversationsChange]);

  return <ConversationStoreContext.Provider value={store}>{children}</ConversationStoreContext.Provider>;
}

export const getConversationStore = (): ConversationStore => {
  if (!useConversationStore) {
    throw new Error("Kas UI store has not been initialized. Ensure KasUIProvider is mounted.");
  }

  return useConversationStore;
};

export const getConversationStoreState = (): ConversationStoreState => {
  return getConversationStore().getState();
};
