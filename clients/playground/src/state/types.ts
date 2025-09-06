import type { Message } from "@/types";

export type FeatureFlag = "enable-code-execution" | "enable-metric-highlights";

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
}

export interface WorkspaceState {
  version: string;
  conversations: Record<string, Conversation>;
}

export interface WorkspaceLocalState {
  namespace: string;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  selectedConversationId: string;
  filePath?: string;
  selectedTab: "preview" | "code";
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface WorkspaceActions {
  onError?: (error: any) => void;
}

export interface WorkspaceProviderProps extends WorkspaceActions {
  namespace?: string;
  initialState: WorkspaceState;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
}

export type WorkspaceStore = WorkspaceState & { actions: WorkspaceActions; local: WorkspaceLocalState };

export type Mutators = [["zustand/devtools", never], ["zustand/immer", never], ["zustand/persist", any]];
