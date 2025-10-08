import { createContext, useRef } from "react";
import type { Mutate, StoreApi, UseBoundStore } from "zustand";
import { createStore } from "./createStore";
import type { Mutators, WorkspaceStore } from "./types";

export const WorkspaceContext = createContext<UseBoundStore<StoreApi<WorkspaceStore>> | null>(null);

export let useWorkspaceStore: UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>;

export function WorkspaceProvider({ children }: React.PropsWithChildren) {
  const storeRef = useRef<UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>>(null);

  if (!storeRef.current) {
    useWorkspaceStore = createStore();
    storeRef.current = useWorkspaceStore;
  }

  return <WorkspaceContext.Provider value={storeRef.current}>{children}</WorkspaceContext.Provider>;
}
