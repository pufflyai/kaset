import { DEFAULT_APPROVAL_GATED_TOOLS, DEFAULT_THEME, DEFAULT_WALLPAPER } from "../constant";
import type { WorkspaceState } from "./types";

export const DEFAULT_STATE: WorkspaceState = {
  version: "1.0",
  desktop: {
    windows: [],
    nextZIndex: 1,
  },
  settings: {
    provider: "openai",
    modelId: "gpt-5",
    webllmModelId: "gemma-4-E2B-it-q4f16_1-MLC",
    baseUrl: "",
    apiKey: "",
    approvalGatedTools: [...DEFAULT_APPROVAL_GATED_TOOLS],
    mcpServers: [],
    activeMcpServerIds: [],
    theme: DEFAULT_THEME,
    wallpaper: DEFAULT_WALLPAPER,
    reactScanEnabled: false,
  },
};
