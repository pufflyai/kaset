import { useWorkspaceStore } from "../WorkspaceProvider";
import type { WorkspaceSettings } from "../types";

export const getWorkspaceSettings = (): WorkspaceSettings => {
  return useWorkspaceStore.getState().settings;
};
