import { useEffect } from "react";
import type { StoreApi } from "zustand";
import type { TodoStore } from "../types";

const POLL_INTERVAL_MS = 2000;

export function useDirectoryWatcher(store: StoreApi<TodoStore>) {
  useEffect(() => {
    let cancelled = false;
    let running = false;
    let intervalId: number | null = null;

    const refreshSafely = async () => {
      if (cancelled || running) return;
      running = true;

      try {
        await store.getState().refreshLists();
      } catch (error) {
        if (!cancelled) {
          console.warn("Todo refresh error", error);
        }
      } finally {
        running = false;
      }
    };

    (async () => {
      try {
        await store.getState().initialize();
      } catch (error) {
        console.warn("Todo initialization error", error);
      }
    })();

    if (typeof window !== "undefined" && typeof window.setInterval === "function") {
      intervalId = window.setInterval(() => {
        refreshSafely().catch((error) => {
          if (!cancelled) {
            console.warn("Todo polling error", error);
          }
        });
      }, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId != null && typeof window !== "undefined" && typeof window.clearInterval === "function") {
        window.clearInterval(intervalId);
      }
    };
  }, [store]);
}
