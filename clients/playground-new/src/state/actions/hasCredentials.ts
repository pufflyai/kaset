import { useWorkspaceStore } from "../WorkspaceProvider";

export const hasCredentials = () => {
  const state = useWorkspaceStore.getState();
  return Boolean(state.settings.apiKey || state.settings.baseUrl);
};
