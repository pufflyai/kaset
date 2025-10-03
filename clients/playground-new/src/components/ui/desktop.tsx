import { Box } from "@chakra-ui/react";
import { shortUID } from "@pstdio/prompt-utils";
import { ListTodoIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DesktopIcon } from "./desktop-icon";
import { Window, type DesktopApp, type DesktopWindow, type Position, type Size } from "./window";

interface DesktopState {
  windows: DesktopWindow[];
  nextZIndex: number;
  openApp: (appId: string) => void;
  focusWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximize: (windowId: string, container?: Size) => void;
  setPosition: (windowId: string, position: Position) => void;
  setSize: (windowId: string, size: Size) => void;
  showDesktop: () => void;
  restoreAll: () => void;
}

const WINDOW_STORAGE_KEY = "kaset-playground-desktop";

const createWindowId = (appId: string) => `${appId}-${shortUID()}`;

const default_app = {
  minSize: { width: 200, height: 100 },
  id: "unknown",
  title: "Unknown",
  icon: ListTodoIcon,
  description: "Unknown app",
  defaultPosition: { x: 120, y: 80 },
  defaultSize: { width: 800, height: 600 },
  singleton: false,
  render: () => <Box p="md">Unknown app</Box>,
};

const desktopApps: DesktopApp[] = [default_app];

const getAppById = (appId: string) => desktopApps.find((app) => app.id === appId) ?? default_app;

export const useDesktopStore = create<DesktopState>()(
  persist(
    (set, get) => ({
      windows: [],
      nextZIndex: 1,
      openApp: (appId) => {
        const state = get();
        const app = getAppById(appId);
        const existing = state.windows.find((window) => window.appId === appId && app.singleton !== false);

        if (existing) {
          set({
            windows: state.windows.map((window) =>
              window.id === existing.id
                ? {
                    ...window,
                    isMinimized: false,
                    zIndex: state.nextZIndex,
                  }
                : window,
            ),
            nextZIndex: state.nextZIndex + 1,
          });
          return;
        }

        const id = createWindowId(appId);
        const offset = state.windows.length * 24;
        const newWindow: DesktopWindow = {
          id,
          appId,
          title: app.title,
          position: app.defaultPosition ? { ...app.defaultPosition } : { x: 120 + offset, y: 80 + offset },
          size: { ...app.defaultSize },
          zIndex: state.nextZIndex,
          isMinimized: false,
          isMaximized: false,
          openedAt: Date.now(),
        };

        set({
          windows: [...state.windows, newWindow],
          nextZIndex: state.nextZIndex + 1,
        });
      },
      focusWindow: (windowId) => {
        const state = get();
        if (!state.windows.some((window) => window.id === windowId)) return;

        set({
          windows: state.windows.map((window) =>
            window.id === windowId
              ? {
                  ...window,
                  isMinimized: false,
                  zIndex: state.nextZIndex,
                }
              : window,
          ),
          nextZIndex: state.nextZIndex + 1,
        });
      },
      closeWindow: (windowId) => {
        const state = get();
        const remaining = state.windows.filter((window) => window.id !== windowId);
        const nextZIndex = Math.max(1, Math.max(0, ...remaining.map((window) => window.zIndex)) + 1);
        set({
          windows: remaining,
          nextZIndex,
        });
      },
      minimizeWindow: (windowId) => {
        const state = get();

        set({
          windows: state.windows.map((window) =>
            window.id === windowId
              ? {
                  ...window,
                  isMinimized: true,
                }
              : window,
          ),
        });
      },
      toggleMaximize: (windowId, container) => {
        const state = get();

        set({
          windows: state.windows.map((window) => {
            if (window.id !== windowId) return window;

            if (!window.isMaximized) {
              return {
                ...window,
                isMaximized: true,
                isMinimized: false,
                restoreBounds: {
                  position: window.position,
                  size: window.size,
                },
                position: { x: 0, y: 0 },
                size: container ?? window.size,
                zIndex: state.nextZIndex,
              };
            }

            const restore = window.restoreBounds;
            if (!restore) {
              return {
                ...window,
                isMaximized: false,
              };
            }

            return {
              ...window,
              isMaximized: false,
              isMinimized: false,
              restoreBounds: undefined,
              position: restore.position,
              size: restore.size,
              zIndex: state.nextZIndex,
            };
          }),
          nextZIndex: state.nextZIndex + 1,
        });
      },
      setPosition: (windowId, position) => {
        const state = get();

        set({
          windows: state.windows.map((window) =>
            window.id === windowId
              ? {
                  ...window,
                  position,
                }
              : window,
          ),
        });
      },
      setSize: (windowId, size) => {
        const state = get();

        set({
          windows: state.windows.map((window) =>
            window.id === windowId
              ? {
                  ...window,
                  size,
                }
              : window,
          ),
        });
      },
      showDesktop: () => {
        const state = get();

        set({
          windows: state.windows.map((window) => ({
            ...window,
            isMinimized: true,
          })),
        });
      },
      restoreAll: () => {
        const state = get();

        set({
          windows: state.windows.map((window) => ({
            ...window,
            isMinimized: false,
            isMaximized: false,
            restoreBounds: undefined,
          })),
        });
      },
    }),
    {
      name: WINDOW_STORAGE_KEY,
      storage: typeof window === "undefined" ? undefined : createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        nextZIndex: state.nextZIndex,
        windows: state.windows.map(({ restoreBounds: _, ...window }) => window),
      }),
      version: 1,
    },
  ),
);

export const Desktop = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSizeRef = useRef<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const windows = useDesktopStore((state) => state.windows);
  const openApp = useDesktopStore((state) => state.openApp);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const setPosition = useDesktopStore((state) => state.setPosition);
  const setSize = useDesktopStore((state) => state.setSize);

  const handleSelectApp = useCallback((appId: string) => {
    setSelectedAppId(appId);
  }, []);

  const handleOpenApp = useCallback(
    (appId: string) => {
      setSelectedAppId(appId);
      openApp(appId);
    },
    [openApp],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || typeof ResizeObserver === "undefined") return;

    const element = containerRef.current;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const size = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };

      containerSizeRef.current = size;
      setContainerSize(size);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    containerSizeRef.current = containerSize;
  }, [containerSize]);

  const focusedId = useMemo(() => {
    let current: DesktopWindow | undefined;
    windows.forEach((window) => {
      if (window.isMinimized) return;
      if (!current || window.zIndex > current.zIndex) current = window;
    });

    return current?.id;
  }, [windows]);

  const visibleWindows = useMemo(() => windows.sort((a, b) => a.zIndex - b.zIndex), [windows]);

  return (
    <Box ref={containerRef} position="relative" height="100%" width="100%" overflow="hidden">
      <Box position="absolute" inset="0" padding="lg" display="grid" gap="xl" alignContent="start">
        {desktopApps.map((app) => (
          <DesktopIcon
            key={app.id}
            icon={app.icon}
            label={app.title}
            isSelected={selectedAppId === app.id}
            onSelect={() => handleSelectApp(app.id)}
            onFocus={() => handleSelectApp(app.id)}
            onOpen={() => handleOpenApp(app.id)}
          />
        ))}
      </Box>
      {visibleWindows.map((window) => (
        <Window
          key={window.id}
          window={window}
          app={getAppById(window.appId)}
          containerSize={containerSize}
          isFocused={focusedId === window.id}
          onFocus={() => focusWindow(window.id)}
          onClose={() => closeWindow(window.id)}
          onMinimize={() => minimizeWindow(window.id)}
          onMaximize={() => toggleMaximize(window.id, containerSize ?? undefined)}
          onPositionChange={(position) => setPosition(window.id, position)}
          onSizeChange={(size) => setSize(window.id, size)}
        />
      ))}
    </Box>
  );
};
