import type { DesktopApp, DesktopWindow, Position, Size } from "@/state/types";
import { Box, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { Minimize2, Square, X } from "lucide-react";
import { memo, useRef } from "react";
import type { DraggableData } from "react-rnd";
import { Rnd } from "react-rnd";

const clampBounds = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

const SNAP_THRESHOLD = 12;

interface WindowChromeProps {
  window: DesktopWindow;
  app: DesktopApp;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

interface WindowContentProps {
  app: DesktopApp;
  windowId: string;
}

const WindowContentComponent = (props: WindowContentProps) => {
  const { app, windowId } = props;
  return <>{app.render(windowId)}</>;
};

const WindowContent = memo(
  WindowContentComponent,
  (prev, next) => prev.app === next.app && prev.windowId === next.windowId,
);

const WindowChrome = (props: WindowChromeProps) => {
  const { window, app, isFocused, onFocus, onClose, onMaximize } = props;

  return (
    <Flex
      background="background.primary"
      direction="column"
      height="100%"
      borderWidth="1px"
      borderRadius={window.isMaximized ? undefined : "md"}
      overflow="hidden"
      boxShadow={isFocused ? "high" : "low"}
      onMouseDown={onFocus}
    >
      <Flex align="center" justify="space-between" paddingX="sm" paddingY="xs" gap="sm">
        <HStack gap="xs">
          <app.icon size={16} />
          <Text fontSize="sm" fontWeight="medium">
            {window.title}
          </Text>
        </HStack>
        <HStack gap="2xs">
          <IconButton aria-label={window.isMaximized ? "Restore" : "Maximize"} size="2xs" onClick={onMaximize}>
            {window.isMaximized ? <Minimize2 size={14} /> : <Square size={14} />}
          </IconButton>
          <IconButton aria-label="Close" size="2xs" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </HStack>
      </Flex>
      <Box flex="1" overflow="hidden">
        <WindowContent app={app} windowId={window.id} />
      </Box>
    </Flex>
  );
};

interface WindowProps {
  window: DesktopWindow;
  app: DesktopApp;
  containerSize: Size | null;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onPositionChange: (position: Position) => void;
  onSizeChange: (size: Size) => void;
  onSnapPreview: (side: "left" | "right" | null) => void;
  onSnap: (options: {
    side: "left" | "right";
    position: Position;
    size: Size;
    restore: { position: Position; size: Size };
  }) => void;
  onReleaseSnap: () => void;
  snapEnabled: boolean;
}

export const Window = (props: WindowProps) => {
  const {
    window,
    app,
    containerSize,
    isFocused,
    onFocus,
    onClose,
    onMinimize,
    onMaximize,
    onPositionChange,
    onSizeChange,
    onSnapPreview,
    onSnap,
    onReleaseSnap,
    snapEnabled,
  } = props;

  const pendingSnapReleaseRef = useRef(false);
  const releasedSnapThisDragRef = useRef(false);
  const wasSnappedAtDragStartRef = useRef(false);

  const size = window.isMaximized ? (containerSize ?? window.size) : window.size;
  const maxX = containerSize ? Math.max(0, containerSize.width - size.width) : undefined;
  const maxY = containerSize ? Math.max(0, containerSize.height - size.height) : undefined;
  const position = window.isMaximized
    ? { x: 0, y: 0 }
    : {
        x: maxX === undefined ? window.position.x : clampBounds(window.position.x, maxX),
        y: maxY === undefined ? window.position.y : clampBounds(window.position.y, maxY),
      };

  const computeSnapPlacement = (side: "left" | "right") => {
    if (!containerSize) return null;

    const { width: containerWidth, height: containerHeight } = containerSize;
    const snappedWidth = Math.min(containerWidth, Math.max(app.minSize.width, Math.floor(containerWidth / 2)));
    const snappedHeight = containerHeight;
    const snappedX = side === "left" ? 0 : Math.max(0, containerWidth - snappedWidth);

    return {
      position: { x: snappedX, y: 0 },
      size: { width: snappedWidth, height: snappedHeight },
    };
  };

  const handleDragStart = () => {
    onFocus();
    if (window.isMaximized) return;

    wasSnappedAtDragStartRef.current = false;
    releasedSnapThisDragRef.current = false;
    pendingSnapReleaseRef.current = false;

    if (!snapEnabled) return;

    const isSnapped = Boolean(window.snapRestore);

    wasSnappedAtDragStartRef.current = isSnapped;
    releasedSnapThisDragRef.current = false;
    pendingSnapReleaseRef.current = isSnapped;
    onSnapPreview(null);
  };

  const handleDrag = (_: unknown, data: DraggableData) => {
    if (window.isMaximized) return;

    if (!snapEnabled) return;

    if (pendingSnapReleaseRef.current) {
      const hasMoved = data.x !== position.x || data.y !== position.y;

      if (hasMoved) {
        pendingSnapReleaseRef.current = false;
        releasedSnapThisDragRef.current = true;
        onSnapPreview(null);
        onReleaseSnap();
        return;
      }
    }

    if (!containerSize) {
      onSnapPreview(null);
      return;
    }

    const { width: containerWidth } = containerSize;
    const windowWidth = size.width;
    const snappedLeft = data.x <= SNAP_THRESHOLD;
    const snappedRight = data.x + windowWidth >= containerWidth - SNAP_THRESHOLD;

    if (snappedLeft) {
      onSnapPreview("left");
      return;
    }

    if (snappedRight) {
      onSnapPreview("right");
      return;
    }

    onSnapPreview(null);
  };

  const handleDragStop = (_: unknown, data: DraggableData) => {
    if (window.isMaximized) return;

    const startedSnapped = wasSnappedAtDragStartRef.current;
    const releasedSnap = releasedSnapThisDragRef.current;

    pendingSnapReleaseRef.current = false;
    wasSnappedAtDragStartRef.current = false;
    releasedSnapThisDragRef.current = false;

    if (!snapEnabled) {
      onPositionChange({ x: data.x, y: data.y });
      return;
    }

    onSnapPreview(null);

    if (startedSnapped && !releasedSnap) {
      return;
    }

    if (containerSize) {
      const { width: containerWidth } = containerSize;
      const windowWidth = size.width;
      const snappedLeft = data.x <= SNAP_THRESHOLD;
      const snappedRight = data.x + windowWidth >= containerWidth - SNAP_THRESHOLD;

      if (snappedLeft || snappedRight) {
        const side = snappedLeft ? "left" : "right";
        const placement = computeSnapPlacement(side);

        if (placement) {
          onSnap({
            side,
            position: placement.position,
            size: placement.size,
            restore: {
              position: { ...window.position },
              size: { ...window.size },
            },
          });
        }

        return;
      }
    }

    onPositionChange({ x: data.x, y: data.y });
  };

  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={position}
      bounds="parent"
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={(_, __, ref, ___, positionUpdate) => {
        if (window.isMaximized) return;
        onSizeChange({ width: ref.offsetWidth, height: ref.offsetHeight });
        onPositionChange(positionUpdate);
      }}
      enableResizing={!window.isMaximized && (!window.snapRestore || !snapEnabled)}
      disableDragging={window.isMaximized}
      style={{ zIndex: window.zIndex, position: "absolute" }}
      minWidth={app.minSize.width}
      minHeight={app.minSize.height}
    >
      <Box height="100%" width="100%">
        <WindowChrome
          window={window}
          app={app}
          isFocused={isFocused}
          onFocus={onFocus}
          onClose={onClose}
          onMinimize={onMinimize}
          onMaximize={onMaximize}
        />
      </Box>
    </Rnd>
  );
};
