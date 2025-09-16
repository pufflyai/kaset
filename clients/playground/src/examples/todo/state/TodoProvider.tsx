import { createContext, useEffect, useRef } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { watchDirectory } from "@pstdio/opfs-utils";
import { createTodoStore, TODO_LISTS_DIR } from "./createStore";
import type { TodoStore } from "./types";

export const TodoContext = createContext<UseBoundStore<StoreApi<TodoStore>> | null>(null);

export let useTodoStore: UseBoundStore<StoreApi<TodoStore>>;

export function TodoProvider({ children }: React.PropsWithChildren) {
  const storeRef = useRef<UseBoundStore<StoreApi<TodoStore>> | null>(null);

  if (!storeRef.current) {
    useTodoStore = createTodoStore();
    storeRef.current = useTodoStore;
  }

  useEffect(() => {
    if (!storeRef.current) return;

    const store = storeRef.current;

    let cleanup: null | (() => void) = null;
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        await store.getState().initialize();

        cleanup = await watchDirectory(
          TODO_LISTS_DIR,
          (changes) => {
            if (cancelled) return;

            const { selectedList } = store.getState();
            let needsListRefresh = false;
            let needsItemRefresh = false;

            for (const change of changes) {
              const relativePath = change.path.join("/");
              if (change.type === "appeared" || change.type === "disappeared") {
                needsListRefresh = true;
              }

              if (
                selectedList &&
                relativePath === selectedList &&
                (change.type === "modified" || change.type === "appeared")
              ) {
                needsItemRefresh = true;
              }
            }

            if (needsListRefresh) {
              void store.getState().refreshLists();
            }

            if (needsItemRefresh && selectedList) {
              void store.getState().readAndParse(selectedList);
            }
          },
          { recursive: false, emitInitial: false, signal: controller.signal },
        );
      } catch (error) {
        console.warn("Todo watcher error", error);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      cleanup?.();
    };
  }, []);

  return <TodoContext.Provider value={storeRef.current}>{children}</TodoContext.Provider>;
}
