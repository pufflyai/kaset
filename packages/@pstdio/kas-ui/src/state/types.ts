import type { UIMessage } from "../adapters/kas";

export interface Conversation {
  id: string;
  name: string;
  messages: UIMessage[];
  streaming: boolean;
}

export interface ConversationStoreState {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
}

export interface ConversationStoreSnapshot {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
}

export type ConversationStoreHydration = ConversationStoreSnapshot;
