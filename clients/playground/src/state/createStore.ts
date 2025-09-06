import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEFAULT_STATE } from "./defaultState";
import type { WorkspaceLocalState, WorkspaceProviderProps, WorkspaceStore } from "./types";

export const createStore = (
  props: WorkspaceProviderProps,
  local: WorkspaceLocalState,
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
      },
    ),
  );

  return store;
};
