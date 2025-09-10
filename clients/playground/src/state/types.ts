import type { Message } from "@/types";

export type FeatureFlag = "enable-code-execution" | "enable-metric-highlights";

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  projectId: string;
}

export interface WorkspaceState {
  version: string;
  conversations: Record<string, Conversation>;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  selectedProjectId: "todo" | "slides";
  selectedTab: "preview" | "code";
  selectedConversationId: string;
  filePath?: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  approvalGatedTools?: string[];
}

export type WorkspaceStore = WorkspaceState;

export type Mutators = [["zustand/devtools", never], ["zustand/immer", never], ["zustand/persist", any]];
