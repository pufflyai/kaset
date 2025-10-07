import { Box } from "@chakra-ui/react";
import { useMemo, useState } from "react";
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
import type { DesktopApp, DesktopWindow, Size } from "@/state/types";
import { Window } from "./window";

const SNAP_FEATURE_ENABLED = false;

export interface WindowHostProps {
  windows: DesktopWindow[];
  containerSize: Size | null;
  getAppById: (appId: string) => DesktopApp | undefined;
}

export const WindowHost = ({ windows, containerSize, getAppById }: WindowHostProps) => {
  const [snapPreviewSide, setSnapPreviewSide] = useState<"left" | "right" | null>(null);

  const orderedWindows = useMemo(() => [...windows].sort((a, b) => a.zIndex - b.zIndex), [windows]);

  const focusedId = useMemo(() => {
    let current: DesktopWindow | undefined;

    windows.forEach((window) => {
      if (window.isMinimized) return;
      if (!current || window.zIndex > current.zIndex) current = window;
    });

    return current?.id;
  }, [windows]);

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
            isFocused={focusedId === window.id}
            onFocus={() => focusDesktopWindow(window.id)}
            onClose={() => closeDesktopWindow(window.id)}
            onMinimize={() => minimizeDesktopWindow(window.id)}
            onMaximize={() => toggleDesktopWindowMaximize(window.id, containerSize ?? undefined)}
            onPositionChange={(position) => setDesktopWindowPosition(window.id, position)}
            onSizeChange={(size) => setDesktopWindowSize(window.id, size)}
            onSnapPreview={(side) => {
              if (!SNAP_FEATURE_ENABLED) return;
              setSnapPreviewSide((current) => (current === side ? current : side));
            }}
            onSnap={(options) => {
              if (!SNAP_FEATURE_ENABLED) return;
              applyDesktopWindowSnap(window.id, options);
              setSnapPreviewSide(null);
            }}
            onReleaseSnap={() => {
              if (!SNAP_FEATURE_ENABLED) return;
              releaseDesktopWindowSnap(window.id);
              setSnapPreviewSide(null);
            }}
          />
        );
      })}
    </>
  );
};
