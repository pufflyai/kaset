import type { UIMessage } from "@pstdio/kas/kas-ui";
import type { ModelPricing } from "../../models";
import type { StoreApi, UseBoundStore } from "zustand";

export interface Conversation {
  id: string;
  name: string;
  messages: UIMessage[];
}

export interface ChatSettings {
  modelId: string | null;
  apiKey?: string;
  baseUrl?: string;
  approvalGatedTools: string[];
  credentialsReady: boolean;
  modelPricing?: ModelPricing;
  onOpenSettings?: () => void;
}

export interface ConversationState {
  conversations: Record<string, Conversation>;
  selectedConversationId: string | null;
  chatSettings: ChatSettings;
}

export type ConversationStore = ConversationState;

export type BoundConversationStore = UseBoundStore<StoreApi<ConversationStore>>;
