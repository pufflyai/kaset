import type { WorkspaceSettings } from "../types";
import { useWorkspaceStore } from "../WorkspaceProvider";

export const getWorkspaceSettings = (): WorkspaceSettings => {
  return useWorkspaceStore.getState().settings;
};
