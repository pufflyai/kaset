import type { ModelPricing } from "@/models";
import type { UIMessage } from "@pstdio/kas/kas-ui";

export interface Conversation {
  id: string;
  name: string;
  messages: UIMessage[];
}

export interface ChatSettings {
  modelId?: string;
  apiKey?: string;
  baseUrl?: string;
  approvalGatedTools: string[];
  credentialsReady: boolean;
  modelPricing?: ModelPricing;
}

export interface ConversationUiState {
  onOpenSettings?: () => void;
}

export interface ConversationStoreState {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  chatSettings: ChatSettings;
  ui: ConversationUiState;
}

export interface ConversationStoreSnapshot {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
}

export interface ConversationStoreHydration {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  chatSettings: ChatSettings;
}
