import { PluginWindow } from "@/components/ui/plugin-window";
import type { PluginDesktopSurface } from "@/services/plugins/surfaces";
import { DEFAULT_DESKTOP_APP_ICON, type DesktopApp } from "@/state/types";
import { Box, Text } from "@chakra-ui/react";
import type { IconName } from "lucide-react/dynamic";
import { DEFAULT_WINDOW_SIZE } from "../constants";
import { normalizePosition, normalizeSize } from "./normalization";

export const renderSurfaceWindow = (surface: PluginDesktopSurface, windowId: string) => {
  const descriptor = surface.window;

  if (!descriptor) {
    return (
      <Box padding="md">
        <Text fontSize="sm">This plugin surface does not define a window entry.</Text>
      </Box>
    );
  }

  if (!descriptor.entry) {
    return (
      <Box padding="md">
        <Text fontSize="sm">This plugin window is missing an entry file.</Text>
      </Box>
    );
  }

  return (
    <PluginWindow pluginId={surface.pluginId} surfaceId={surface.surfaceId} instanceId={windowId} snapshotVersion={1} />
  );
};

export const createDesktopApp = (surface: PluginDesktopSurface): DesktopApp => {
  const icon = (surface.icon as IconName | undefined) ?? DEFAULT_DESKTOP_APP_ICON;
  const defaultSize = normalizeSize(surface.defaultSize, DEFAULT_WINDOW_SIZE);
  const defaultPosition = normalizePosition(surface.defaultPosition);
  const description = surface.description ?? `Surface provided by ${surface.pluginId}`;
  const singleton = surface.singleton ?? true;

  const app: DesktopApp = {
    id: `${surface.pluginId}/${surface.surfaceId}`,
    title: surface.title,
    icon,
    description,
    defaultSize,
    singleton,
    render: (windowId: string) => renderSurfaceWindow(surface, windowId),
  };

  if (defaultPosition) {
    app.defaultPosition = defaultPosition;
  }

  return app;
};
