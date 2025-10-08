import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { DEFAULT_STATE } from "./defaultState";
import type { WorkspaceStore } from "./types";

export const createStore = () => {
  const store = create<WorkspaceStore>()(
    persist(
      devtools(
        immer(
          subscribeWithSelector(() => ({
            ...DEFAULT_STATE,
          })),
        ),
        { name: "kaset-workspace" },
      ),
      {
        name: `kaset-workspace`,
      },
    ),
  );

  return store;
};
