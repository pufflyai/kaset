import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEFAULT_STATE } from "./defaultState";
import type { WorkspaceLocalState, WorkspaceProviderProps, WorkspaceStore } from "./types";
import { mergeLocalState } from "./utils/mergeLocalState";

export const createStore = (
  props: WorkspaceProviderProps,
  local: WorkspaceLocalState,
  setLocalState: (local: WorkspaceLocalState) => void,
) => {
  const { initialState, namespace, ...actions } = props;

  const store = create<WorkspaceStore>()(
    persist(
      devtools(
        immer(
          subscribeWithSelector(() => ({
            ...DEFAULT_STATE,
            ...initialState,
            actions,
            local,
          })),
        ),
        { name: "kaset-workspace" },
      ),
      {
        name: `kaset-workspace-${namespace}`,
        partialize: (state) => {
          setLocalState(state.local);
          // Persist conversations and local UI state; omit actions
          return { conversations: state.conversations, local: state.local, version: state.version };
        },
        merge: mergeLocalState,
      },
    ),
  );

  return store;
};
