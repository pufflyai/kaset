import type { Message } from "@/types";

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  accessToken?: string;
}

export interface WorkspaceState {
  version: string;
  conversations: Record<string, Conversation>;
  selectedConversationId: string;
  settings: {
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
    approvalGatedTools?: string[];
    mcpServers: McpServerConfig[];
    activeMcpServerIds?: string[];
  };
}

export type WorkspaceStore = WorkspaceState;

export type Mutators = [["zustand/devtools", never], ["zustand/immer", never], ["zustand/persist", any]];
