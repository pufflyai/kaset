import {
  buildAdaptiveResultFromColor,
  defaultAdaptiveResult,
  type AdaptiveWallpaperResult,
} from "@/hooks/useAdaptiveWallpaperSample";
import {
  ensurePluginHost,
  getPluginDisplayName,
  subscribeToPluginDesktopSurfaces,
  type PluginDesktopSurface,
} from "@/services/plugins/plugin-host";
import { deletePluginDirectories, downloadPluginBundle } from "@/services/plugins/plugin-management";
import { PluginTinyUiWindow } from "@/services/plugins/tiny-ui-window";
import { openDesktopApp } from "@/state/actions/desktop";
import { DEFAULT_DESKTOP_APP_ICON, type DesktopApp, type Size } from "@/state/types";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Menu, Portal, Text, chakra } from "@chakra-ui/react";
import { readFile } from "@pstdio/opfs-utils";
import { FastAverageColor } from "fast-average-color";
import { Download, Trash2 } from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { DesktopIcon } from "./desktop-icon";
import { MenuItem } from "./menu-item";
import { toaster } from "./toaster";
import { WindowHost } from "./window-host";

const DEFAULT_WINDOW_SIZE = { width: 840, height: 620 };

const toBlobPart = (bytes: Uint8Array) => {
  if (bytes.buffer instanceof ArrayBuffer) {
    const { buffer, byteOffset, byteLength } = bytes;
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }

  const clone = new Uint8Array(bytes);
  return clone.buffer;
};

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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [wallpaperElement, setWallpaperElement] = useState<HTMLImageElement | null>(null);
  const [averageColor, setAverageColor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ pluginId: string; label: string } | null>(null);
  const iconPalette = useMemo<AdaptiveWallpaperResult>(() => {
    if (!averageColor) {
      return defaultAdaptiveResult;
    }

    return buildAdaptiveResultFromColor(averageColor, 3, 0.4, defaultAdaptiveResult);
  }, [averageColor]);
  const averageColorFacRef = useRef<FastAverageColor | null>(null);

  const windows = useWorkspaceStore((state) => state.desktop.windows);
  const wallpaper = useWorkspaceStore((state) => state.settings.wallpaper);

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

  const getPluginIdFromAppId = useCallback((appId: string) => appId.split("/")[0] ?? appId, []);

  const handleDownloadPlugin = useCallback(async (pluginId: string, label: string) => {
    try {
      await downloadPluginBundle({ pluginId, label });
      toaster.create({ type: "success", title: `Preparing download for ${label}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toaster.create({
        type: "error",
        title: `Failed to download ${label}`,
        description: message,
      });
    }
  }, []);

  const handleRequestDelete = useCallback((pluginId: string, label: string) => {
    setPendingDelete({ pluginId, label });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      await deletePluginDirectories(pendingDelete.pluginId);
      toaster.create({ type: "success", title: `Deleted ${pendingDelete.label}` });
      setPendingDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toaster.create({ type: "error", title: `Failed to delete ${pendingDelete.label}`, description: message });
      throw error;
    }
  }, [pendingDelete]);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
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

  useEffect(() => {
    return () => {
      averageColorFacRef.current?.destroy();
      averageColorFacRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!wallpaperElement || !backgroundImageUrl) {
      setAverageColor(null);
      return;
    }

    if (!averageColorFacRef.current && typeof window !== "undefined") {
      averageColorFacRef.current = new FastAverageColor();
    }

    const fac = averageColorFacRef.current;
    if (!fac) {
      setAverageColor(null);
      return;
    }

    let cancelled = false;

    const computeAverage = () => {
      fac
        .getColorAsync(wallpaperElement, { algorithm: "sqrt" })
        .then((result) => {
          if (cancelled) return;

          setAverageColor((current) => (current === result.hex ? current : result.hex));
        })
        .catch(() => {
          if (!cancelled) {
            setAverageColor(null);
          }
        });
    };

    const handleLoad = () => {
      computeAverage();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            computeAverage();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(wallpaperElement);
    }

    if ("complete" in wallpaperElement) {
      wallpaperElement.addEventListener("load", handleLoad);
    }

    computeAverage();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if ("complete" in wallpaperElement) {
        wallpaperElement.removeEventListener("load", handleLoad);
      }
    };
  }, [wallpaperElement, backgroundImageUrl]);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadWallpaper = async () => {
      if (!wallpaper) {
        setBackgroundImageUrl(null);
        setWallpaperElement(null);
        return;
      }

      try {
        const fileData = await readFile(wallpaper, { encoding: null });

        const blob = new Blob([toBlobPart(fileData)], { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);
        setBackgroundImageUrl(objectUrl);
      } catch (error) {
        console.error("Failed to load wallpaper:", error);
        setBackgroundImageUrl(null);
        setWallpaperElement(null);
      }
    };

    loadWallpaper();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [wallpaper]);

  const handleWallpaperRef = useCallback((node: HTMLImageElement | null) => {
    setWallpaperElement(node);
  }, []);

  return (
    <Box ref={containerRef} position="relative" height="100%" width="100%" overflow="hidden">
      {backgroundImageUrl ? (
        <chakra.img
          ref={handleWallpaperRef}
          src={backgroundImageUrl}
          alt=""
          crossOrigin="anonymous"
          pointerEvents="none"
          position="absolute"
          inset="0"
          width="100%"
          height="100%"
          objectFit="cover"
          zIndex={0}
        />
      ) : null}
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
        zIndex={1}
      >
        {apps.map((app) => {
          const pluginId = getPluginIdFromAppId(app.id);
          const pluginLabel = getPluginDisplayName(pluginId) || pluginId;

          return (
            <Menu.Root key={app.id}>
              <Menu.ContextTrigger>
                <DesktopIcon
                  icon={app.icon}
                  label={app.title}
                  isSelected={selectedAppId === app.id}
                  onSelect={() => handleSelectApp(app.id)}
                  onFocus={() => handleSelectApp(app.id)}
                  onOpen={() => handleOpenApp(app.id)}
                  palette={iconPalette}
                />
              </Menu.ContextTrigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content bg="background.primary">
                    <MenuItem
                      leftIcon={<Download size={16} />}
                      primaryLabel="Download plugin"
                      onClick={() => handleDownloadPlugin(pluginId, pluginLabel)}
                    />
                    <MenuItem
                      leftIcon={<Trash2 size={16} />}
                      primaryLabel="Delete plugin"
                      onClick={() => handleRequestDelete(pluginId, pluginLabel)}
                    />
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          );
        })}
      </Box>
      <WindowHost windows={windows} containerSize={containerSize} getAppById={getAppById} />
      <DeleteConfirmationModal
        open={Boolean(pendingDelete)}
        onClose={handleCancelDelete}
        onDelete={async () => handleConfirmDelete()}
        headline="Delete Plugin"
        notificationText={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.label}"? This action cannot be undone.`
            : undefined
        }
        buttonText="Delete"
        closeOnInteractOutside={false}
      />
    </Box>
  );
};
