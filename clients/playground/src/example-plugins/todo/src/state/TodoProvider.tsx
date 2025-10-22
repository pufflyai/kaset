import { createContext, useRef } from "react";
import type { PropsWithChildren } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import type { TinyUiHost } from "../host";
import { createTodoStore } from "./createStore";
import { useDirectoryWatcher } from "../hooks/useDirectoryWatcher";
import type { TodoStore } from "./types";

export const TodoContext = createContext<UseBoundStore<StoreApi<TodoStore>> | null>(null);

export let useTodoStore: UseBoundStore<StoreApi<TodoStore>>;

interface TodoProviderProps extends PropsWithChildren {
  host: TinyUiHost;
}

export function TodoProvider(props: TodoProviderProps) {
  const { host, children } = props;
  const storeRef = useRef<UseBoundStore<StoreApi<TodoStore>> | null>(null);

  if (!storeRef.current) {
    useTodoStore = createTodoStore(host);
    storeRef.current = useTodoStore;
  }

  const store = storeRef.current!;

  useDirectoryWatcher(store);

  return <TodoContext.Provider value={store}>{children}</TodoContext.Provider>;
}
