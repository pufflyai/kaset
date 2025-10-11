import {
  ensurePluginHost,
  subscribeToPluginDesktopSurfaces,
  type PluginDesktopSurface,
} from "@/services/plugins/plugin-host";
import { PluginTinyUiWindow } from "@/services/plugins/tiny-ui-window";
import { openDesktopApp } from "@/state/actions/desktop";
import { DEFAULT_DESKTOP_APP_ICON, type DesktopApp, type Size } from "@/state/types";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Menu, Portal, Text } from "@chakra-ui/react";
import type { IconName } from "lucide-react/dynamic";
import { Download, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import { downloadPluginFolder, deletePlugin } from "@/services/plugins/manage";
import { getPluginDisplayName } from "@/services/plugins/plugin-host";
import { DesktopIcon } from "./desktop-icon";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";
import { WindowHost } from "./window-host";

const DEFAULT_WINDOW_SIZE = { width: 840, height: 620 };

const normalizeSize = (
  value: { width: number; height: number } | undefined,
  fallback: { width: number; height: number },
) => {
  if (!value) return { ...fallback };
  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return { ...fallback };
  return { width, height };
};

const normalizePosition = (value?: { x: number; y: number }) => {
  if (!value) return undefined;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
};

const renderSurfaceWindow = (surface: PluginDesktopSurface, windowId: string) => {
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
    <PluginTinyUiWindow
      pluginId={surface.pluginId}
      pluginWindow={descriptor}
      surfaceId={surface.surfaceId}
      instanceId={windowId}
    />
  );
};

const createDesktopAppFromSurface = (surface: PluginDesktopSurface): DesktopApp => {
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

export const Desktop = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSizeRef = useRef<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [pluginApps, setPluginApps] = useState<DesktopApp[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ pluginId: string; pluginName: string } | null>(null);

  const windows = useWorkspaceStore((state) => state.desktop.windows);

  useEffect(() => {
    const unsubscribe = subscribeToPluginDesktopSurfaces((surfaces) => {
      const apps = surfaces
        .map((surface) => createDesktopAppFromSurface(surface))
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
      setPluginApps(apps);
    });

    ensurePluginHost().catch((error) => {
      console.error("[desktop] Failed to initialize plugin host", error);
    });

    return unsubscribe;
  }, []);

  const apps = useMemo(() => pluginApps, [pluginApps]);

  const appsById = useMemo(() => {
    const map = new Map<string, DesktopApp>();
    apps.forEach((app) => {
      map.set(app.id, app);
    });
    return map;
  }, [apps]);

  useEffect(() => {
    if (!selectedAppId) return;
    if (!appsById.has(selectedAppId)) {
      setSelectedAppId(null);
    }
  }, [appsById, selectedAppId]);

  const getAppById = useCallback((appId: string) => appsById.get(appId), [appsById]);

  const handleSelectApp = useCallback(
    (appId: string) => {
      setSelectedAppId(appId);
    },
    [setSelectedAppId],
  );

  const handleOpenApp = useCallback(
    (appId: string) => {
      const app = getAppById(appId);
      if (!app) return;

      setSelectedAppId(appId);
      openDesktopApp(app);
    },
    [setSelectedAppId, openDesktopApp, getAppById],
  );

  const getPluginIdFromAppId = useCallback((appId: string) => {
    const [pluginId] = appId.split("/");
    return pluginId ?? appId;
  }, []);

  const handleDownloadPlugin = useCallback(
    async (appId: string) => {
      const pluginId = getPluginIdFromAppId(appId);
      const pluginName = getPluginDisplayName(pluginId);

      try {
        await downloadPluginFolder(pluginId);
        toaster.create({ type: "info", title: `Downloading ${pluginName} plugin files` });
      } catch (error) {
        console.error(`[desktop] Failed to download plugin folder for ${pluginId}`, error);
        toaster.create({ type: "error", title: `Failed to download ${pluginName} plugin files` });
      }
    },
    [getPluginIdFromAppId],
  );

  const handleDeletePlugin = useCallback(
    (appId: string) => {
      const pluginId = getPluginIdFromAppId(appId);
      const pluginName = getPluginDisplayName(pluginId);
      setDeleteTarget({ pluginId, pluginName });
    },
    [getPluginIdFromAppId],
  );

  const handleConfirmDeletePlugin = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deletePlugin(deleteTarget.pluginId);
      toaster.create({ type: "success", title: `Deleted ${deleteTarget.pluginName} plugin` });
    } catch (error) {
      console.error(`[desktop] Failed to delete plugin ${deleteTarget.pluginId}`, error);
      toaster.create({ type: "error", title: `Failed to delete ${deleteTarget.pluginName} plugin` });
      throw error;
    }
  }, [deleteTarget]);

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteTarget(null);
  }, []);

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

  return (
    <Box ref={containerRef} position="relative" height="100%" width="100%" overflow="hidden">
      <Box
        position="absolute"
        inset="0"
        padding="lg"
        display="grid"
        gap="xl"
        alignContent="start"
        justifyContent="start"
        justifyItems="center"
        gridTemplateColumns="repeat(auto-fit, minmax(5rem, max-content))"
      >
        {apps.map((app) => (
          <Menu.Root
            key={app.id}
            onOpenChange={({ open }) => {
              if (open) {
                handleSelectApp(app.id);
              }
            }}
          >
            <Menu.ContextTrigger asChild>
              <DesktopIcon
                icon={app.icon}
                label={app.title}
                isSelected={selectedAppId === app.id}
                onSelect={() => handleSelectApp(app.id)}
                onFocus={() => handleSelectApp(app.id)}
                onOpen={() => handleOpenApp(app.id)}
              />
            </Menu.ContextTrigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content bg="background.primary" paddingY="xxs">
                  <MenuItem
                    leftIcon={<Download size={16} />}
                    primaryLabel="Download plugin folder"
                    onClick={() => handleDownloadPlugin(app.id)}
                  />
                  <MenuItem
                    leftIcon={<Trash2 size={16} />}
                    primaryLabel="Delete plugin"
                    onClick={() => handleDeletePlugin(app.id)}
                  />
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        ))}
      </Box>
      <WindowHost windows={windows} containerSize={containerSize} getAppById={getAppById} />
      <DeleteConfirmationModal
        open={deleteTarget !== null}
        onClose={handleCloseDeleteModal}
        onDelete={handleConfirmDeletePlugin}
        headline="Delete Plugin"
        notificationText={
          deleteTarget
            ? `Are you sure you want to delete the "${deleteTarget.pluginName}" plugin? This action cannot be undone.`
            : undefined
        }
        buttonText="Delete plugin"
      />
    </Box>
  );
};
