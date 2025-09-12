import { PROJECTS_ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { createKasAgent } from "@pstdio/kas";
import { requestApproval } from "./approval";

export function getAgent() {
  const state = useWorkspaceStore.getState();
  return createKasAgent({
    model: state.modelId,
    apiKey: state.apiKey!,
    baseURL: state.baseUrl,
    workspaceDir: `${PROJECTS_ROOT}/${state.selectedProjectId}`,
    approvalGatedTools: state.approvalGatedTools,
    requestApproval,
  });
}
