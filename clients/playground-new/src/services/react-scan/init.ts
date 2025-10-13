import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { WorkspaceState } from "@/state/types";
import { scan, setOptions } from "react-scan";

const WORKSPACE_STORAGE_KEY = "kaset-workspace";

const getPersistedHideReactScan = () => {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as { state?: WorkspaceState } | undefined;
    return parsed?.state?.settings?.hideReactScan ?? false;
  } catch (error) {
    console.warn("Failed to read React Scan setting from storage:", error);
    return false;
  }
};

const initializeReactScan = () => {
  if (typeof window === "undefined") return;

  const hideReactScan = getPersistedHideReactScan();
  scan({
    enabled: !hideReactScan,
  });

  const subscribeToWorkspaceStore = () => {
    if (!useWorkspaceStore) {
      window.requestAnimationFrame(subscribeToWorkspaceStore);
      return;
    }

    const currentHide = useWorkspaceStore.getState().settings.hideReactScan ?? false;
    if (currentHide !== hideReactScan) {
      setOptions({ enabled: !currentHide });
    }

    let previousHide = currentHide;

    useWorkspaceStore.subscribe((state) => {
      const nextHide = state.settings.hideReactScan ?? false;
      if (nextHide === previousHide) return;
      previousHide = nextHide;
      setOptions({ enabled: !nextHide });
    });
  };

  subscribeToWorkspaceStore();
};

initializeReactScan();
