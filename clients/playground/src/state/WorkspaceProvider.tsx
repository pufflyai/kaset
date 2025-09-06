import { createContext, useRef } from "react";
import type { Mutate, StoreApi, UseBoundStore } from "zustand";
import { createStore } from "./createStore";
import type { Mutators, WorkspaceLocalState, WorkspaceProviderProps, WorkspaceStore } from "./types";

export const WorkspaceContext = createContext<UseBoundStore<StoreApi<WorkspaceStore>> | null>(null);

export let useWorkspaceStore: UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>;

export function WorkspaceProvider({ children, ...props }: React.PropsWithChildren<WorkspaceProviderProps>) {
  const storeRef = useRef<UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>>(null);
  const defaultConversationId = Object.keys(props.initialState.conversations)[0] || "default";

  const emptyLocalState: WorkspaceLocalState = {
    namespace: props.namespace || "",
    selectedConversationId: defaultConversationId,
    selectedTab: "preview",
    modelId: "gpt-5-mini",
  };

  if (!storeRef.current) {
    const initialLocalState = { ...emptyLocalState };
    useWorkspaceStore = createStore(props, initialLocalState);
    storeRef.current = useWorkspaceStore;
  }

  return <WorkspaceContext.Provider value={storeRef.current}>{children}</WorkspaceContext.Provider>;
}
