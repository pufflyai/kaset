import type { UIMessage } from "@pstdio/kas/kas-ui";

export interface Conversation {
  id: string;
  name: string;
  messages: UIMessage[];
}

export interface ConversationUiState {
  onOpenSettings?: () => void;
}

export interface ConversationStoreState {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  ui: ConversationUiState;
}

export interface ConversationStoreSnapshot {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
}

export type ConversationStoreHydration = ConversationStoreSnapshot;
