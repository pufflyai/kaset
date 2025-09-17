import { createContext, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { createTodoStore } from "./createStore";
import { useDirectoryWatcher } from "./hooks/useDirectoryWatcher";
import { useOpfsSync } from "./hooks/useOpfsSync";
import type { TodoStore } from "./types";

export const TodoContext = createContext<UseBoundStore<StoreApi<TodoStore>> | null>(null);

export let useTodoStore: UseBoundStore<StoreApi<TodoStore>>;

export function TodoProvider({ children }: React.PropsWithChildren) {
  const storeRef = useRef<UseBoundStore<StoreApi<TodoStore>> | null>(null);

  if (!storeRef.current) {
    useTodoStore = createTodoStore();
    storeRef.current = useTodoStore;
  }

  const store = storeRef.current!;

  useOpfsSync(store);
  useDirectoryWatcher(store);

  return <TodoContext.Provider value={storeRef.current}>{children}</TodoContext.Provider>;
}
