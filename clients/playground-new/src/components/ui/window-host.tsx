import { Box } from "@chakra-ui/react";
import { useCallback, useMemo, useState } from "react";
import {
  applyDesktopWindowSnap,
  closeDesktopWindow,
  focusDesktopWindow,
  minimizeDesktopWindow,
  releaseDesktopWindowSnap,
  setDesktopWindowPosition,
  setDesktopWindowSize,
  toggleDesktopWindowMaximize,
} from "@/state/actions/desktop";
import type { DesktopApp, DesktopWindow, Position, Size } from "@/state/types";
import { Window } from "./window";

const SNAP_FEATURE_ENABLED = false;

export interface WindowHostProps {
  windows: DesktopWindow[];
  focusedWindowId: string | null;
  containerSize: Size | null;
  getAppById: (appId: string) => DesktopApp | undefined;
}
export const WindowHost = ({ windows, focusedWindowId, containerSize, getAppById }: WindowHostProps) => {
  const [snapPreviewSide, setSnapPreviewSide] = useState<"left" | "right" | null>(null);

  const orderedWindows = useMemo(() => [...windows].sort((a, b) => a.zIndex - b.zIndex), [windows]);

  const handleFocus = useCallback((windowId: string) => focusDesktopWindow(windowId), []);
  const handleClose = useCallback((windowId: string) => closeDesktopWindow(windowId), []);
  const handleMinimize = useCallback((windowId: string) => minimizeDesktopWindow(windowId), []);
  const handleMaximize = useCallback(
    (windowId: string, size: Size | null) => toggleDesktopWindowMaximize(windowId, size ?? undefined),
    [],
  );
  const handlePositionChange = useCallback(
    (windowId: string, position: Position) => setDesktopWindowPosition(windowId, position),
    [],
  );
  const handleSizeChange = useCallback((windowId: string, size: Size) => setDesktopWindowSize(windowId, size), []);

  const handleSnapPreview = useCallback((side: "left" | "right" | null) => {
    if (!SNAP_FEATURE_ENABLED) return;
    setSnapPreviewSide((current) => (current === side ? current : side));
  }, []);

  const handleSnap = useCallback(
    (
      windowId: string,
      options: {
        side: "left" | "right";
        position: Position;
        size: Size;
        restore: { position: Position; size: Size };
      },
    ) => {
      if (!SNAP_FEATURE_ENABLED) return;
      applyDesktopWindowSnap(windowId, options);
      setSnapPreviewSide(null);
    },
    [],
  );

  const handleReleaseSnap = useCallback((windowId: string) => {
    if (!SNAP_FEATURE_ENABLED) return;
    releaseDesktopWindowSnap(windowId);
    setSnapPreviewSide(null);
  }, []);

  const snapPreviewStyle = useMemo(() => {
    if (!SNAP_FEATURE_ENABLED || !snapPreviewSide) return null;

    if (!containerSize) {
      return {
        side: snapPreviewSide,
        width: "50%",
      };
    }

    const halfWidth = Math.max(0, Math.floor(containerSize.width / 2));

    return {
      side: snapPreviewSide,
      width: `${halfWidth}px`,
    };
  }, [containerSize, snapPreviewSide]);

  return (
    <>
      {snapPreviewStyle ? (
        <Box
          pointerEvents="none"
          position="absolute"
          top="0"
          bottom="0"
          left={snapPreviewStyle.side === "left" ? 0 : undefined}
          right={snapPreviewStyle.side === "right" ? 0 : undefined}
          width={snapPreviewStyle.width}
          borderRadius="sm"
          border="1px solid"
          borderColor="background.accent-primary.light"
          background="background.accent-primary.very-light"
          opacity={0.7}
          zIndex={2}
        />
      ) : null}
      {orderedWindows.map((window) => {
        const app = getAppById(window.appId);
        if (!app) return null;

        return (
          <Window
            key={window.id}
            window={window}
            app={app}
            snapEnabled={SNAP_FEATURE_ENABLED}
            containerSize={containerSize}
            isFocused={focusedWindowId === window.id}
            onFocus={handleFocus}
            onClose={handleClose}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
            onPositionChange={handlePositionChange}
            onSizeChange={handleSizeChange}
            onSnapPreview={handleSnapPreview}
            onSnap={handleSnap}
            onReleaseSnap={handleReleaseSnap}
          />
        );
      })}
    </>
  );
};
