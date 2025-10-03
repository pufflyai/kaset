import { Box, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import { Minimize2, Square, X } from "lucide-react";
import type { ReactNode } from "react";
import { Rnd } from "react-rnd";

export interface Size {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface DesktopApp {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  defaultSize: Size;
  minSize: Size;
  singleton?: boolean;
  defaultPosition?: Position;
  render: (windowId: string) => ReactNode;
}

export interface DesktopWindow {
  id: string;
  appId: string;
  title: string;
  position: Position;
  size: Size;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  openedAt: number;
  restoreBounds?: {
    position: Position;
    size: Size;
  };
}

const clampBounds = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

interface WindowChromeProps {
  window: DesktopWindow;
  app: DesktopApp;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

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
        {app.render(window.id)}
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
  } = props;

  const size = window.isMaximized ? (containerSize ?? window.size) : window.size;
  const maxX = containerSize ? Math.max(0, containerSize.width - size.width) : undefined;
  const maxY = containerSize ? Math.max(0, containerSize.height - size.height) : undefined;
  const position = window.isMaximized
    ? { x: 0, y: 0 }
    : {
        x: maxX === undefined ? window.position.x : clampBounds(window.position.x, maxX),
        y: maxY === undefined ? window.position.y : clampBounds(window.position.y, maxY),
      };

  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={position}
      bounds="parent"
      onDragStart={onFocus}
      onDragStop={(_, data) => {
        if (window.isMaximized) return;
        onPositionChange({ x: data.x, y: data.y });
      }}
      onResizeStop={(_, __, ref, ___, positionUpdate) => {
        if (window.isMaximized) return;
        onSizeChange({ width: ref.offsetWidth, height: ref.offsetHeight });
        onPositionChange(positionUpdate);
      }}
      enableResizing={!window.isMaximized}
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
