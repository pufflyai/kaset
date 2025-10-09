import { DEFAULT_APPROVAL_GATED_TOOLS } from "@pstdio/kas";
import type { ThemePreference, WorkspaceState } from "./types";

export const DEFAULT_STATE: WorkspaceState = {
  version: "1.0",
  conversations: {
    default: {
      id: "default",
      name: "Conversation 1",
      messages: [],
    },
  },
  selectedConversationId: "default",
  desktop: {
    windows: [],
    nextZIndex: 1,
  },
  settings: {
    modelId: "gpt-5-mini",
    baseUrl: "",
    apiKey: "",
    approvalGatedTools: [...DEFAULT_APPROVAL_GATED_TOOLS],
    mcpServers: [],
    activeMcpServerIds: [],
    theme: "light" satisfies ThemePreference,
  },
};
