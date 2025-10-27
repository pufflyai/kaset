import { DEFAULT_STATE } from "../defaultState";
import { useWorkspaceStore } from "../WorkspaceProvider";
export const resetWorkspace = () => {
  useWorkspaceStore.setState(
    (state) => {
      state.desktop.windows = [];
      state.desktop.nextZIndex = DEFAULT_STATE.desktop.nextZIndex;
    },
    false,
    "workspace/reset",
  );
};
