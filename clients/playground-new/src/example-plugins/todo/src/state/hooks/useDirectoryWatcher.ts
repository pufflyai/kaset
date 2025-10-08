import { useEffect } from "react";
import type { StoreApi } from "zustand";
import { watchDirectory } from "../../opfs";
import { TODO_LISTS_DIR } from "../createStore";
import type { TodoStore } from "../types";

export function useDirectoryWatcher(store: StoreApi<TodoStore>) {
  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
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
              store.getState().refreshLists();
            }

            if (needsItemRefresh && selectedList) {
              store.getState().readAndParse(selectedList);
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
  }, [store]);
}
