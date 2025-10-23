import { createContext, useEffect, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { shallow } from "zustand/shallow";
import { createConversationStore } from "./createConversationStore";
import type {
  ChatSettings,
  Conversation,
  ConversationStoreHydration,
  ConversationStoreSnapshot,
  ConversationStoreState,
} from "./types";

export const ConversationStoreContext = createContext<UseBoundStore<StoreApi<ConversationStoreState>> | null>(null);

export let useConversationStore: UseBoundStore<StoreApi<ConversationStoreState>>;

const chatSettingsEqual = (a: ChatSettings, b: ChatSettings) => {
  if (a === b) return true;
  if (!a || !b) return false;

  const arraysEqual =
    a.approvalGatedTools.length === b.approvalGatedTools.length &&
    a.approvalGatedTools.every((tool, index) => tool === b.approvalGatedTools[index]);

  return (
    arraysEqual &&
    a.modelId === b.modelId &&
    a.apiKey === b.apiKey &&
    a.baseUrl === b.baseUrl &&
    a.credentialsReady === b.credentialsReady &&
    a.modelPricing === b.modelPricing
  );
};

interface KasUIProviderProps extends Omit<ConversationStoreHydration, "conversations"> {
  children: React.ReactNode;
  conversations: Record<string, Conversation>;
  onConversationsChange?: (snapshot: ConversationStoreSnapshot) => void;
}

export function KasUIProvider(props: KasUIProviderProps) {
  const { children, conversations, selectedConversationId, chatSettings, onConversationsChange } = props;
  const storeRef = useRef<UseBoundStore<StoreApi<ConversationStoreState>> | null>(null);

  if (!storeRef.current) {
    useConversationStore = createConversationStore({
      conversations,
      selectedConversationId,
      chatSettings,
    });
    storeRef.current = useConversationStore;
  }

  const store = storeRef.current!;

  useEffect(() => {
    const current = store.getState();
    if (
      current.conversations === conversations &&
      current.selectedConversationId === selectedConversationId
    ) {
      return;
    }

    store.setState(
      (draft) => {
        draft.conversations = conversations;
        draft.selectedConversationId = selectedConversationId;
      },
      false,
      "kas-ui/hydrate/conversations",
    );
  }, [store, conversations, selectedConversationId]);

  useEffect(() => {
    const current = store.getState().chatSettings;
    if (chatSettingsEqual(current, chatSettings)) return;

    store.setState(
      (draft) => {
        draft.chatSettings = {
          ...chatSettings,
          approvalGatedTools: [...chatSettings.approvalGatedTools],
        };
      },
      false,
      "kas-ui/hydrate/chat-settings",
    );
  }, [store, chatSettings]);

  useEffect(() => {
    if (!onConversationsChange) return;

    return store.subscribe(
      (state) => ({
        conversations: state.conversations,
        selectedConversationId: state.selectedConversationId,
      }),
      (snapshot) => {
        onConversationsChange(snapshot);
      },
      { equalityFn: shallow },
    );
  }, [store, onConversationsChange]);

  return <ConversationStoreContext.Provider value={store}>{children}</ConversationStoreContext.Provider>;
}

export const getConversationStore = (): UseBoundStore<StoreApi<ConversationStoreState>> => {
  if (!useConversationStore) {
    throw new Error("Kas UI store has not been initialized. Ensure KasUIProvider is mounted.");
  }

  return useConversationStore;
};

export const getConversationStoreState = (): ConversationStoreState => {
  return getConversationStore().getState();
};
