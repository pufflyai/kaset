import { useEffect } from "react";
import type { StoreApi } from "zustand";
import type { TodoHostHelpers, TodoDirectorySnapshot } from "../../opfs";
import { TODO_LISTS_DIR } from "../createStore";
import type { TodoStore } from "../types";

const createEntryMap = (snapshot: TodoDirectorySnapshot) => {
  const map = new Map<string, { lastModified?: number; size?: number }>();
  for (const entry of snapshot.entries) {
    map.set(entry.name, { lastModified: entry.lastModified, size: entry.size });
  }
  return map;
};

export function useDirectoryWatcher(store: StoreApi<TodoStore>, helpers: TodoHostHelpers) {
  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let cancelled = false;
    const controller = new AbortController();
    let previousSignature: string | null = null;
    let previousEntries = new Map<string, { lastModified?: number; size?: number }>();

    (async () => {
      try {
        await store.getState().initialize();

        cleanup = await helpers.watchDirectory(
          TODO_LISTS_DIR,
          (snapshot) => {
            if (cancelled) return;

            if (previousSignature === snapshot.signature) return;
            const nextEntries = createEntryMap(snapshot);
            const { selectedList } = store.getState();
            let needsListRefresh = false;
            let needsItemRefresh = false;

            if (previousSignature == null) {
              previousEntries = nextEntries;
              previousSignature = snapshot.signature;

              if (selectedList && nextEntries.has(selectedList)) {
                store.getState().readAndParse(selectedList);
              }
              return;
            }

            const previousNames = new Set(previousEntries.keys());

            for (const [name] of nextEntries) {
              if (!previousNames.has(name)) {
                needsListRefresh = true;
                break;
              }
            }

            if (!needsListRefresh) {
              for (const name of previousEntries.keys()) {
                if (!nextEntries.has(name)) {
                  needsListRefresh = true;
                  break;
                }
              }
            }

            if (!needsListRefresh && selectedList && nextEntries.has(selectedList)) {
              const previousMeta = previousEntries.get(selectedList);
              const nextMeta = nextEntries.get(selectedList);
              if (previousMeta?.lastModified !== nextMeta?.lastModified || previousMeta?.size !== nextMeta?.size) {
                needsItemRefresh = true;
              }
            }

            previousEntries = nextEntries;
            previousSignature = snapshot.signature;

            if (needsListRefresh) {
              store.getState().refreshLists();
            }

            if (!needsListRefresh && needsItemRefresh && selectedList) {
              store.getState().readAndParse(selectedList);
            }
          },
          { emitInitial: false, signal: controller.signal },
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
  }, [store, helpers]);
}
