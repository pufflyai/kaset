import { Box } from "@chakra-ui/react";
import { memo, useCallback, useMemo, useState } from "react";
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
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { shallow } from "zustand/shallow";

const SNAP_FEATURE_ENABLED = false;

export interface WindowHostProps {
  windows: DesktopWindow[];
  containerSize: Size | null;
  getAppById: (appId: string) => DesktopApp | undefined;
}

interface WindowEntryProps {
  windowId: string;
  containerSize: Size | null;
  getAppById: (appId: string) => DesktopApp | undefined;
  snapEnabled: boolean;
  onSnapPreview: (side: "left" | "right" | null) => void;
  onSnap: (
    windowId: string,
    options: {
      side: "left" | "right";
      position: Position;
      size: Size;
      restore: { position: Position; size: Size };
    },
  ) => void;
  onReleaseSnap: (windowId: string) => void;
}

const WindowEntryComponent = (props: WindowEntryProps) => {
  const { windowId, containerSize, getAppById, snapEnabled, onSnapPreview, onSnap, onReleaseSnap } = props;

  const { window, isFocused } = useWorkspaceStore(
    useCallback(
      (state) => {
        const target = state.desktop.windows.find((candidate) => candidate.id === windowId);
        return {
          window: target,
          isFocused: state.desktop.focusedWindowId === windowId,
        };
      },
      [windowId],
    ),
    shallow,
  );

  const app = window ? getAppById(window.appId) : undefined;

  const handleFocus = useCallback(() => focusDesktopWindow(windowId), [windowId]);
  const handleClose = useCallback(() => closeDesktopWindow(windowId), [windowId]);
  const handleMinimize = useCallback(() => minimizeDesktopWindow(windowId), [windowId]);
  const handleMaximize = useCallback(
    () => toggleDesktopWindowMaximize(windowId, containerSize ?? undefined),
    [windowId, containerSize],
  );
  const handlePositionChange = useCallback((position: Position) => setDesktopWindowPosition(windowId, position), [windowId]);
  const handleSizeChange = useCallback((size: Size) => setDesktopWindowSize(windowId, size), [windowId]);
  const handleSnapPreview = useCallback(
    (side: "left" | "right" | null) => {
      if (!snapEnabled) return;
      onSnapPreview(side);
    },
    [onSnapPreview, snapEnabled],
  );
  const handleSnap = useCallback(
    (options: { side: "left" | "right"; position: Position; size: Size; restore: { position: Position; size: Size } }) => {
      if (!snapEnabled) return;
      onSnap(windowId, options);
    },
    [onSnap, snapEnabled, windowId],
  );
  const handleReleaseSnap = useCallback(() => {
    if (!snapEnabled) return;
    onReleaseSnap(windowId);
  }, [onReleaseSnap, snapEnabled, windowId]);

  if (!window || !app) {
    return null;
  }

  return (
    <Window
      window={window}
      app={app}
      snapEnabled={snapEnabled}
      containerSize={containerSize}
      isFocused={isFocused}
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
};

const WindowEntry = memo(WindowEntryComponent);

export const WindowHost = ({ windows, containerSize, getAppById }: WindowHostProps) => {
  const [snapPreviewSide, setSnapPreviewSide] = useState<"left" | "right" | null>(null);

  const orderedWindowIds = useMemo(
    () =>
      [...windows]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((window) => window.id),
    [windows],
  );

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
      {orderedWindowIds.map((windowId) => (
        <WindowEntry
          key={windowId}
          windowId={windowId}
          containerSize={containerSize}
          getAppById={getAppById}
          snapEnabled={SNAP_FEATURE_ENABLED}
          onSnapPreview={(side) => {
            if (!SNAP_FEATURE_ENABLED) return;
            setSnapPreviewSide((current) => (current === side ? current : side));
          }}
          onSnap={(id, options) => {
            if (!SNAP_FEATURE_ENABLED) return;
            applyDesktopWindowSnap(id, options);
            setSnapPreviewSide(null);
          }}
          onReleaseSnap={(id) => {
            if (!SNAP_FEATURE_ENABLED) return;
            releaseDesktopWindowSnap(id);
            setSnapPreviewSide(null);
          }}
        />
      ))}
    </>
  );
};
