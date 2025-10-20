import { DEFAULT_WALLPAPER } from "../../constant";
import { useWorkspaceStore } from "../WorkspaceProvider";
import type { WorkspaceSettings } from "../types";

export const saveWorkspaceSettings = (settings: WorkspaceSettings, actionName = "settings/save-llm-config") => {
  useWorkspaceStore.setState(
    (state) => {
      state.settings.apiKey = settings.apiKey || undefined;
      state.settings.baseUrl = settings.baseUrl || undefined;
      state.settings.modelId = settings.modelId || "gpt-5";
      state.settings.approvalGatedTools = settings.approvalGatedTools ? [...settings.approvalGatedTools] : [];
      state.settings.mcpServers = settings.mcpServers.map((server) => ({ ...server }));
      state.settings.activeMcpServerIds =
        settings.activeMcpServerIds && settings.activeMcpServerIds.length > 0 ? [...settings.activeMcpServerIds] : [];
      state.settings.theme = settings.theme ?? "light";
      state.settings.wallpaper = settings.wallpaper ?? DEFAULT_WALLPAPER;
      state.settings.reactScanEnabled = settings.reactScanEnabled ?? false;
    },
    false,
    actionName,
  );
};
