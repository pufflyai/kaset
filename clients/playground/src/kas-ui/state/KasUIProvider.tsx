import { createContext, useContext, useRef } from "react";
import type { BoundConversationStore } from "./types";

const ConversationStoreContext = createContext<BoundConversationStore | null>(null);

export let useConversationStore: BoundConversationStore;

interface KasUIProviderProps {
  store: BoundConversationStore;
  children: React.ReactNode;
}

export function KasUIProvider(props: KasUIProviderProps) {
  const { store, children } = props;
  const storeRef = useRef<BoundConversationStore | null>(null);

  if (!storeRef.current || storeRef.current !== store) {
    storeRef.current = store;
    useConversationStore = store;
  }

  if (!storeRef.current) {
    throw new Error("KasUIProvider requires a valid store instance");
  }

  return <ConversationStoreContext.Provider value={storeRef.current}>{children}</ConversationStoreContext.Provider>;
}

export function useConversationStoreContext() {
  const store = useContext(ConversationStoreContext);
  if (!store) {
    throw new Error("KasUIProvider is missing in the component tree");
  }

  return store;
}
