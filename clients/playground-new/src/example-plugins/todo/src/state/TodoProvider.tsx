import { createContext, useRef } from "react";
import type { PropsWithChildren } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { createTodoStore, type TodoStoreDependencies } from "./createStore";
import { useDirectoryWatcher } from "./hooks/useDirectoryWatcher";
import { createTodoHostHelpers, type TinyHost, type TodoHostHelpers } from "../opfs";
import type { TodoStore } from "./types";

export const TodoContext = createContext<UseBoundStore<StoreApi<TodoStore>> | null>(null);

export let useTodoStore: UseBoundStore<StoreApi<TodoStore>>;

interface TodoProviderProps extends PropsWithChildren {
  host: TinyHost;
}

export function TodoProvider({ children, host }: TodoProviderProps) {
  const storeRef = useRef<UseBoundStore<StoreApi<TodoStore>> | null>(null);
  const helpersRef = useRef<TodoHostHelpers | null>(null);

  if (!storeRef.current) {
    helpersRef.current = createTodoHostHelpers(host);
    const dependencies: TodoStoreDependencies = {
      fs: {
        ensureDir: helpersRef.current.ensureDir,
        listFiles: helpersRef.current.listFiles,
        readFile: helpersRef.current.readFile,
        writeFile: helpersRef.current.writeFile,
        deleteFile: helpersRef.current.deleteFile,
      },
    };
    useTodoStore = createTodoStore(dependencies);
    storeRef.current = useTodoStore;
  } else if (!helpersRef.current) {
    helpersRef.current = createTodoHostHelpers(host);
  }

  const store = storeRef.current!;
  const helpers = helpersRef.current!;

  useDirectoryWatcher(store, helpers);

  return <TodoContext.Provider value={store}>{children}</TodoContext.Provider>;
}
