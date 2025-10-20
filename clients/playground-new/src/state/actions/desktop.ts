import {
  ROOT_FILE_PREFIX,
  createDesktopFileApp,
  normalizeDesktopFilePath,
} from "@/services/desktop/desktop-file-icons";
import { shortUID } from "@pstdio/prompt-utils";
import type { DesktopApp, DesktopWindow, Position, Size } from "../types";
import { useWorkspaceStore } from "../WorkspaceProvider";

const createWindowId = (appId: string) => `${appId}-${shortUID()}`;

const clonePosition = (position: Position): Position => ({ ...position });

const cloneSize = (size: Size): Size => ({ ...size });

const bringToFront = (window: DesktopWindow, nextZIndex: number) => {
  window.isMinimized = false;
  window.zIndex = nextZIndex;
};

const cloneBounds = (position: Position, size: Size) => ({
  position: clonePosition(position),
  size: cloneSize(size),
});

const filePreviewApps = new Map<string, DesktopApp>();

export const openDesktopApp = (app: DesktopApp) => {
  useWorkspaceStore.setState(
    (state) => {
      const { desktop } = state;
      const isSingleton = app.singleton !== false;
      const existing = isSingleton ? desktop.windows.find((window) => window.appId === app.id) : undefined;

      if (existing) {
        bringToFront(existing, desktop.nextZIndex);
        desktop.nextZIndex += 1;
        return;
      }

      const windowId = createWindowId(app.id);
      const offset = desktop.windows.length * 24;

      const position = app.defaultPosition ? clonePosition(app.defaultPosition) : { x: 120 + offset, y: 80 + offset };
      const size = cloneSize(app.defaultSize);

      desktop.windows.push({
        id: windowId,
        appId: app.id,
        title: app.title,
        position,
        size,
        zIndex: desktop.nextZIndex,
        isMinimized: false,
        isMaximized: false,
        openedAt: Date.now(),
      });

      desktop.nextZIndex += 1;
    },
    false,
    "desktop/open-app",
  );
};

interface OpenFilePreviewOptions {
  displayName?: string;
  fallbackApp?: DesktopApp;
}

interface OpenFilePreviewResult {
  app: DesktopApp;
  created: boolean;
}

export const openDesktopFilePreview = (
  path: string,
  options?: OpenFilePreviewOptions,
): OpenFilePreviewResult | null => {
  if (typeof path !== "string") return null;

  const normalizedPath = normalizeDesktopFilePath(path);
  const appId = `${ROOT_FILE_PREFIX}${normalizedPath}`;
  const existing = filePreviewApps.get(appId);

  if (existing) {
    openDesktopApp(existing);
    return { app: existing, created: false };
  }

  const fallbackApp = options?.fallbackApp;
  let app: DesktopApp | undefined;
  let created = false;

  if (fallbackApp && fallbackApp.id === appId) {
    app = fallbackApp;
  } else {
    const displayName = typeof options?.displayName === "string" ? options.displayName : undefined;
    app = createDesktopFileApp({ path: normalizedPath, name: displayName });
    created = true;
  }

  filePreviewApps.set(appId, app);
  openDesktopApp(app);

  return { app, created };
};

export const focusDesktopWindow = (windowId: string) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      bringToFront(target, state.desktop.nextZIndex);
      state.desktop.nextZIndex += 1;
    },
    false,
    "desktop/focus-window",
  );
};

export const closeDesktopWindow = (windowId: string) => {
  useWorkspaceStore.setState(
    (state) => {
      const { windows } = state.desktop;
      const index = windows.findIndex((window) => window.id === windowId);
      if (index === -1) return;

      windows.splice(index, 1);

      const highestZ = windows.reduce((max, window) => (window.zIndex > max ? window.zIndex : max), 0);
      state.desktop.nextZIndex = Math.max(1, highestZ + 1);
    },
    false,
    "desktop/close-window",
  );
};

export const minimizeDesktopWindow = (windowId: string) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      target.isMinimized = true;
    },
    false,
    "desktop/minimize-window",
  );
};

export const toggleDesktopWindowMaximize = (windowId: string, container?: Size) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      const { nextZIndex } = state.desktop;

      if (!target.isMaximized) {
        target.isMaximized = true;
        target.isMinimized = false;
        target.restoreBounds = {
          position: clonePosition(target.position),
          size: cloneSize(target.size),
        };
        target.position = { x: 0, y: 0 };
        if (container) {
          target.size = cloneSize(container);
        }
        target.zIndex = nextZIndex;
        state.desktop.nextZIndex += 1;
        return;
      }

      const restore = target.restoreBounds;
      target.isMaximized = false;
      target.isMinimized = false;
      target.restoreBounds = undefined;
      if (restore) {
        target.position = clonePosition(restore.position);
        target.size = cloneSize(restore.size);
      }
      target.zIndex = nextZIndex;
      state.desktop.nextZIndex += 1;
    },
    false,
    "desktop/toggle-maximize",
  );
};

export const setDesktopWindowPosition = (windowId: string, position: Position) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      target.position = clonePosition(position);
    },
    false,
    "desktop/set-position",
  );
};

export const setDesktopWindowSize = (windowId: string, size: Size) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      target.size = cloneSize(size);
    },
    false,
    "desktop/set-size",
  );
};

export const applyDesktopWindowSnap = (
  windowId: string,
  options: {
    side: "left" | "right";
    position: Position;
    size: Size;
    restore: { position: Position; size: Size };
  },
) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      target.isMaximized = false;
      target.isMinimized = false;
      target.position = clonePosition(options.position);
      target.size = cloneSize(options.size);
      target.snapRestore = cloneBounds(options.restore.position, options.restore.size);
      target.snapSide = options.side;
    },
    false,
    "desktop/apply-snap",
  );
};

export const releaseDesktopWindowSnap = (windowId: string) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target || !target.snapRestore) return;

      const restore = target.snapRestore;

      target.size = cloneSize(restore.size);
      target.snapRestore = undefined;
      target.snapSide = undefined;
    },
    false,
    "desktop/release-snap",
  );
};

export const showDesktopWindows = () => {
  useWorkspaceStore.setState(
    (state) => {
      state.desktop.windows.forEach((window) => {
        window.isMinimized = true;
      });
    },
    false,
    "desktop/show",
  );
};

export const restoreAllDesktopWindows = () => {
  useWorkspaceStore.setState(
    (state) => {
      state.desktop.windows.forEach((window) => {
        window.isMinimized = false;
        window.isMaximized = false;
        window.restoreBounds = undefined;
        window.snapRestore = undefined;
        window.snapSide = undefined;
      });
    },
    false,
    "desktop/restore-all",
  );
};
