import { shortUID } from "@pstdio/prompt-utils";
import type { DesktopApp, DesktopWindow, Position, Size } from "../types";
import { useWorkspaceStore } from "../WorkspaceProvider";

const createWindowId = (appId: string) => `${appId}-${shortUID()}`;

const clonePosition = (position: Position): Position => ({ ...position });

const cloneSize = (size: Size): Size => ({ ...size });

const getNextZIndex = (windows: DesktopWindow[]) => {
  let highest = 0;

  windows.forEach((candidate) => {
    if (candidate.zIndex > highest) {
      highest = candidate.zIndex;
    }
  });

  return highest + 1;
};

const bringToFront = (windows: DesktopWindow[], window: DesktopWindow) => {
  const nextZIndex = getNextZIndex(windows);
  window.isMinimized = false;
  window.zIndex = nextZIndex;
};

const selectTopWindowId = (windows: DesktopWindow[]) => {
  let candidate: DesktopWindow | undefined;

  windows.forEach((window) => {
    if (window.isMinimized) return;
    if (!candidate || window.zIndex > candidate.zIndex) {
      candidate = window;
    }
  });

  return candidate?.id ?? null;
};

const cloneBounds = (position: Position, size: Size) => ({
  position: clonePosition(position),
  size: cloneSize(size),
});

export const openDesktopApp = (app: DesktopApp) => {
  useWorkspaceStore.setState(
    (state) => {
      const { desktop } = state;
      const isSingleton = app.singleton !== false;
      const existing = isSingleton ? desktop.windows.find((window) => window.appId === app.id) : undefined;

      if (existing) {
        bringToFront(desktop.windows, existing);
        desktop.focusedWindowId = existing.id;
        return;
      }

      const windowId = createWindowId(app.id);
      const offset = desktop.windows.length * 24;

      const zIndex = getNextZIndex(desktop.windows);

      const position = app.defaultPosition ? clonePosition(app.defaultPosition) : { x: 120 + offset, y: 80 + offset };
      const size = cloneSize(app.defaultSize);

      desktop.windows.push({
        id: windowId,
        appId: app.id,
        title: app.title,
        position,
        size,
        zIndex,
        isMinimized: false,
        isMaximized: false,
        openedAt: Date.now(),
      });

      desktop.focusedWindowId = windowId;
    },
    false,
    "desktop/open-app",
  );
};

export const focusDesktopWindow = (windowId: string) => {
  useWorkspaceStore.setState(
    (state) => {
      const target = state.desktop.windows.find((window) => window.id === windowId);
      if (!target) return;

      bringToFront(state.desktop.windows, target);
      state.desktop.focusedWindowId = windowId;
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

      state.desktop.focusedWindowId = selectTopWindowId(windows);
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
      if (state.desktop.focusedWindowId === windowId) {
        state.desktop.focusedWindowId = selectTopWindowId(state.desktop.windows);
      }
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
        bringToFront(state.desktop.windows, target);
        state.desktop.focusedWindowId = windowId;
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
      bringToFront(state.desktop.windows, target);
      state.desktop.focusedWindowId = windowId;
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
      state.desktop.focusedWindowId = windowId;
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
      state.desktop.focusedWindowId = windowId;
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
      state.desktop.focusedWindowId = selectTopWindowId(state.desktop.windows);
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
      state.desktop.focusedWindowId = selectTopWindowId(state.desktop.windows);
    },
    false,
    "desktop/restore-all",
  );
};
