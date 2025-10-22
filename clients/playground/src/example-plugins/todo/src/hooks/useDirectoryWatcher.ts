import { useEffect } from "react";
import type { StoreApi } from "zustand";
import type { TodoStore } from "../state/types";

const POLL_INTERVAL_MS = 4000;

export function useDirectoryWatcher(store: StoreApi<TodoStore>) {
  useEffect(() => {
    let cancelled = false;
    let running = false;
    let interval = null;

    const refreshSafely = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        await store.getState().refreshLists();
      } finally {
        running = false;
      }
    };

    refreshSafely();

    interval = window.setInterval(() => {
      refreshSafely().catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [store]);
}
