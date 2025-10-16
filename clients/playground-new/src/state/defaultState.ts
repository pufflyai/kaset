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
    modelId: "gpt-5",
    baseUrl: "",
    apiKey: "",
    approvalGatedTools: [],
    mcpServers: [],
    activeMcpServerIds: [],
    theme: "light" satisfies ThemePreference,
    wallpaper: "kaset.png",
  },
};
