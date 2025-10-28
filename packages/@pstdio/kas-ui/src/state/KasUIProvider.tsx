import { createContext, useRef } from "react";
import type { ReactNode } from "react";
import { createConversationStore } from "./createConversationStore";
import type { ConversationStore } from "./createConversationStore";
import type { ConversationStoreState } from "./types";

export const ConversationStoreContext = createContext<ConversationStore | null>(null);

export let useConversationStore: ConversationStore;

interface KasUIProviderProps {
  children: ReactNode;
}

export function KasUIProvider(props: KasUIProviderProps) {
  const { children } = props;
  const storeRef = useRef<ConversationStore | null>(null);

  if (!storeRef.current) {
    useConversationStore = createConversationStore();
    storeRef.current = useConversationStore;
  }

  const store = storeRef.current!;

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
