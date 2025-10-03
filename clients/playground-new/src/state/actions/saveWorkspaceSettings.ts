import { useWorkspaceStore } from "../WorkspaceProvider";
import type { WorkspaceSettings } from "../types";

export const saveWorkspaceSettings = (
  settings: WorkspaceSettings,
  actionName = "settings/save-llm-config",
) => {
  useWorkspaceStore.setState(
    (state) => {
      state.settings.apiKey = settings.apiKey || undefined;
      state.settings.baseUrl = settings.baseUrl || undefined;
      state.settings.modelId = settings.modelId || "gpt-5-mini";
      state.settings.approvalGatedTools = settings.approvalGatedTools ? [...settings.approvalGatedTools] : [];
      state.settings.mcpServers = settings.mcpServers.map((server) => ({ ...server }));
      state.settings.activeMcpServerIds = settings.activeMcpServerIds && settings.activeMcpServerIds.length > 0
        ? [...settings.activeMcpServerIds]
        : [];

      if ((state as Record<string, unknown>).selectedMcpServerId) {
        delete (state as Record<string, unknown>).selectedMcpServerId;
      }
    },
    false,
    actionName,
  );
};
