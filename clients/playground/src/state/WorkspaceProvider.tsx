import { useQueryStates, parseAsString } from "nuqs";
import { createContext, useEffect, useRef } from "react";
import type { Mutate, StoreApi, UseBoundStore } from "zustand";
import { createStore } from "./createStore";
import type { Mutators, WorkspaceLocalState, WorkspaceProviderProps, WorkspaceStore } from "./types";

export const WorkspaceContext = createContext<UseBoundStore<StoreApi<WorkspaceStore>> | null>(null);

export let useWorkspaceStore: UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>;

export function WorkspaceProvider({
  children,
  featureFlags,
  ...props
}: React.PropsWithChildren<WorkspaceProviderProps>) {
  const storeRef = useRef<UseBoundStore<Mutate<StoreApi<WorkspaceStore>, Mutators>>>(null);
  const defaultConversationId = Object.keys(props.initialState.conversations)[0] || "";

  const emptyLocalState: WorkspaceLocalState = {
    namespace: props.namespace || "",
    featureFlags: featureFlags,
    selectedConversationId: defaultConversationId,
  };

  const [queryState, setQueryState] = useQueryStates({
    file_path: parseAsString,
    conversation_id: parseAsString,
  });

  const setLocalState = (local: WorkspaceLocalState) => {
    setQueryState({
      file_path: local.filePath ?? null,
      conversation_id: local.selectedConversationId ?? null,
    });
  };

  if (!storeRef.current) {
    const initialLocalState = {
      ...emptyLocalState,
      filePath: queryState.file_path ?? undefined,
      selectedConversationId: queryState.conversation_id ?? defaultConversationId,
    };
    useWorkspaceStore = createStore(props, initialLocalState, setLocalState);
    storeRef.current = useWorkspaceStore;
  }

  useEffect(() => {
    useWorkspaceStore.setState((state) => ({ local: { ...state.local, featureFlags } }), false, "feature-flags/update");
  }, [featureFlags]);

  return <WorkspaceContext.Provider value={storeRef.current}>{children}</WorkspaceContext.Provider>;
}
