import { Box, Flex, HStack, IconButton } from "@chakra-ui/react";
import { shortUID } from "@pstdio/prompt-utils";
import { LayoutDashboard } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Window, type DesktopWindow, type Position, type Size } from "./window";

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
  icon: LayoutDashboard,
  description: "Unknown app",
  defaultPosition: { x: 120, y: 80 },
  defaultSize: { width: 800, height: 600 },
  singleton: true,
  render: () => <Box p="md">Unknown app</Box>,
};

export const useDesktopStore = create<DesktopState>()(
  persist(
    (set, get) => ({
      windows: [],
      nextZIndex: 1,
      openApp: (appId) => {
        const state = get();
        const existing = state.windows.find((window) => window.appId === appId && default_app.singleton !== false);
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
          title: default_app.title,
          position: default_app.defaultPosition ?? { x: 120 + offset, y: 80 + offset },
          size: default_app.defaultSize,
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

const formatClock = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

interface TaskbarProps {
  windows: DesktopWindow[];
  focusedId?: string;
  onClickWindow: (window: DesktopWindow) => void;
  onShowDesktop: () => void;
  clock: string;
}

const Taskbar = (props: TaskbarProps) => {
  const { onShowDesktop } = props;

  return (
    <Flex
      position="absolute"
      bottom="0"
      left="0"
      right="0"
      height="56px"
      align="center"
      paddingX="lg"
      paddingY="sm"
      gap="md"
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      zIndex={1_000}
    >
      <IconButton aria-label="Show desktop" size="sm" variant="ghost" onClick={onShowDesktop}>
        <LayoutDashboard size={18} />
      </IconButton>
      <HStack gap="xs" overflow="hidden"></HStack>
    </Flex>
  );
};

export const Desktop = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSizeRef = useRef<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const windows = useDesktopStore((state) => state.windows);
  const openApp = useDesktopStore((state) => state.openApp);
  const focusWindow = useDesktopStore((state) => state.focusWindow);
  const closeWindow = useDesktopStore((state) => state.closeWindow);
  const minimizeWindow = useDesktopStore((state) => state.minimizeWindow);
  const toggleMaximize = useDesktopStore((state) => state.toggleMaximize);
  const setPosition = useDesktopStore((state) => state.setPosition);
  const setSize = useDesktopStore((state) => state.setSize);
  const showDesktop = useDesktopStore((state) => state.showDesktop);

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
    const interval = window.setInterval(() => setClock(formatClock(new Date())), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!useDesktopStore.persist.hasHydrated()) return;
    if (windows.length > 0) return;

    openApp("unknown");
  }, [windows.length, openApp]);

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

  const taskbarWindows = useMemo(() => [...windows].sort((a, b) => a.openedAt - b.openedAt), [windows]);

  const handleTaskbarClick = useCallback(
    (window: DesktopWindow) => {
      if (window.isMinimized || focusedId !== window.id) {
        focusWindow(window.id);
      } else {
        minimizeWindow(window.id);
      }
    },
    [focusWindow, minimizeWindow, focusedId],
  );

  return (
    <Box ref={containerRef} position="relative" height="100%" width="100%" overflow="hidden" color="white">
      <Box
        position="absolute"
        inset="0"
        padding="lg"
        display="grid"
        gridTemplateColumns={{
          base: "repeat(auto-fill, minmax(120px, 1fr))",
          md: "repeat(auto-fill, minmax(140px, 1fr))",
        }}
        gap="xl"
        alignContent="start"
      ></Box>
      {visibleWindows.map((window) => (
        <Window
          key={window.id}
          window={window}
          app={default_app}
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
      <Taskbar
        windows={taskbarWindows}
        focusedId={focusedId}
        onClickWindow={handleTaskbarClick}
        onShowDesktop={showDesktop}
        clock={clock}
      />
    </Box>
  );
};
