import { PLUGIN_DATA_ROOT, ROOT } from "@/constant";
import {
  OPEN_DESKTOP_FILE_EVENT,
  ROOT_FILE_PREFIX,
  createDesktopFileApp,
  getRootFilePathFromAppId,
  type DesktopOpenFileDetail,
} from "@/services/desktop/desktop-file-icons";
import { createDesktopApp } from "@/services/desktop/helpers/createDesktopApp";
import { useDesktopWallpaper } from "@/services/desktop/hooks/useDesktopWallpaper";
import { usePluginSources } from "@/services/plugins/hooks/usePluginSources";
import { host, type PluginSurfacesSnapshot } from "@/services/plugins/host";
import { deriveDesktopSurfaces } from "@/services/plugins/surfaces";
import { openDesktopApp, openDesktopFilePreview } from "@/state/actions/desktop";
import { type DesktopApp, type Size } from "@/state/types";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Menu, Portal, chakra } from "@chakra-ui/react";
import type { DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
import { ls, readFile, watchDirectory } from "@pstdio/opfs-utils";
import { deletePluginDirectories, downloadPluginBundle } from "@pstdio/tiny-plugins";
import { setLockfile } from "@pstdio/tiny-ui";
import { Download, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { DesktopIcon } from "./desktop-icon";
import { MenuItem } from "./menu-item";
import { toaster } from "./toaster";
import { WindowHost } from "./window-host";

// WILL FIX: vibe-coded mess

type LsEntryResult = Awaited<ReturnType<typeof ls>>[number];

const joinRootPath = (relative: string) => {
  const trimmed = relative.replace(/^\/+/, "");
  return trimmed ? `${ROOT}/${trimmed}` : ROOT;
};

const createRootFileApps = (entries: LsEntryResult[]): DesktopApp[] =>
  entries
    .filter((entry) => entry.kind === "file")
    .map((entry) =>
      createDesktopFileApp({
        path: joinRootPath(entry.path),
        name: entry.name,
      }),
    )
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

const triggerBlobDownload = (blob: Blob, filename: string) => {
  if (typeof document === "undefined") {
    throw new Error("Downloads are only supported in browser environments.");
  }

  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  const info = error as { name?: string; code?: string | number };
  return info?.name === "NotFoundError" || info?.code === "ENOENT" || info?.code === 1;
};

export const Desktop = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerSizeRef = useRef<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rootFileApps, setRootFileApps] = useState<DesktopApp[]>([]);
  const [pluginApps, setPluginApps] = useState<DesktopApp[]>([]);
  const ephemeralFileAppsRef = useRef<Map<string, DesktopApp>>(new Map());
  const [ephemeralFileAppsVersion, setEphemeralFileAppsVersion] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<{ pluginId: string; label: string } | null>(null);

  const windows = useWorkspaceStore((state) => state.desktop.windows);
  const wallpaper = useWorkspaceStore((state) => state.settings.wallpaper);

  const { backgroundImageUrl, handleWallpaperRef, iconPalette } = useDesktopWallpaper(wallpaper);

  usePluginSources();

  useEffect(() => {
    let cancelled = false;
    let watcher: DirectoryWatcherCleanup | null = null;
    let loading = false;
    let refreshQueued = false;

    const refresh = async () => {
      if (cancelled) return;
      if (loading) {
        refreshQueued = true;
        return;
      }

      loading = true;
      try {
        const entries = await ls(ROOT, { maxDepth: 1, dirsFirst: false });
        if (!cancelled) {
          setRootFileApps(createRootFileApps(entries));
        }
      } catch (error) {
        if (!cancelled) {
          if (!isNotFoundError(error)) {
            console.error("[desktop] Failed to load playground root files", error);
          }
          setRootFileApps([]);
          if (isNotFoundError(error)) {
            setTimeout(() => {
              if (!cancelled) void refresh();
            }, 1000);
          }
        }
      } finally {
        loading = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void refresh();
        }
      }
    };

    const startWatcher = async () => {
      try {
        watcher = await watchDirectory(
          ROOT,
          () => {
            void refresh();
          },
          { recursive: false },
        );
      } catch (error) {
        if (!isNotFoundError(error)) {
          console.warn("[desktop] Failed to watch playground root directory", error);
        }
        if (isNotFoundError(error)) {
          setTimeout(() => {
            if (!cancelled) void startWatcher();
          }, 1500);
        }
      }
    };

    void refresh();
    void startWatcher();

    return () => {
      cancelled = true;
      watcher?.();
    };
  }, []);

  useEffect(() => {
    host.ensureHost().then((instance) => {
      instance.onDependencyChange(setLockfile);
    });
  }, []);

  useEffect(() => {
    const applySurfaces = (snapshot: PluginSurfacesSnapshot) => {
      const surfaces = snapshot.flatMap(({ pluginId, surfaces }) => {
        const displayName = host.getPluginDisplayName(pluginId) || pluginId;
        return deriveDesktopSurfaces({
          pluginId,
          surfaces,
          manifest: host.getPluginManifest(pluginId),
          displayName,
        });
      });

      const apps = surfaces
        .map((surface) => createDesktopApp(surface))
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

      setPluginApps(apps);
    };

    const unsubscribe = host.subscribeToPluginSurfaces((snapshot) => {
      applySurfaces(snapshot);
    });

    applySurfaces(host.getPluginSurfaces());

    host.ensureHost().catch((error) => {
      console.error("[desktop] Failed to initialize plugin host", error);
    });

    return unsubscribe;
  }, []);

  const visibleApps = useMemo(() => [...rootFileApps, ...pluginApps], [rootFileApps, pluginApps]);

  const appsById = useMemo(() => {
    const map = new Map<string, DesktopApp>();
    visibleApps.forEach((app) => {
      map.set(app.id, app);
    });

    const registry = ephemeralFileAppsRef.current;
    registry.forEach((app, appId) => {
      if (!map.has(appId)) {
        map.set(appId, app);
      }
    });

    return map;
  }, [visibleApps, ephemeralFileAppsVersion]);

  const appsByIdRef = useRef(appsById);

  useEffect(() => {
    appsByIdRef.current = appsById;
  }, [appsById]);

  const registerEphemeralFileApp = useCallback((app: DesktopApp) => {
    const registry = ephemeralFileAppsRef.current;
    const existing = registry.get(app.id);
    if (existing === app) return;

    registry.set(app.id, app);

    const nextMap = new Map(appsByIdRef.current);
    nextMap.set(app.id, app);
    appsByIdRef.current = nextMap;

    setEphemeralFileAppsVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!selectedAppId) return;
    if (!appsById.has(selectedAppId)) {
      setSelectedAppId(null);
    }
  }, [appsById, selectedAppId]);

  useEffect(() => {
    const handleOpenFile = (event: Event) => {
      const detail = (event as CustomEvent<DesktopOpenFileDetail>).detail;
      const rawPath = detail?.path;
      if (typeof rawPath !== "string" || !rawPath.trim()) {
        console.warn("[desktop] Ignoring open file event with invalid path", detail);
        return;
      }

      const normalizedPath = rawPath;
      const displayName = typeof detail?.displayName === "string" ? detail.displayName : undefined;

      const fallbackApp = appsByIdRef.current.get(`${ROOT_FILE_PREFIX}${normalizedPath}`);
      const result = openDesktopFilePreview(rawPath, { displayName, fallbackApp });

      if (!result) {
        console.warn("[desktop] Failed to open file preview", { normalizedPath });
        return;
      }

      if (result.created) {
        registerEphemeralFileApp(result.app);
      }

      setSelectedAppId(result.app.id);
    };

    window.addEventListener(OPEN_DESKTOP_FILE_EVENT, handleOpenFile as EventListener);
    return () => {
      window.removeEventListener(OPEN_DESKTOP_FILE_EVENT, handleOpenFile as EventListener);
    };
  }, [registerEphemeralFileApp, setSelectedAppId, openDesktopFilePreview]);

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

  const handleDownloadFile = useCallback(async (appId: string, label: string) => {
    const filePath = getRootFilePathFromAppId(appId);
    if (!filePath) return;

    try {
      const fileData = await readFile(filePath, { encoding: null });

      if (!(fileData instanceof Uint8Array)) {
        throw new Error("Received unexpected data type when reading file.");
      }

      const blob = new Blob([fileData], { type: "application/octet-stream" });
      triggerBlobDownload(blob, label);
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

  const handleDownloadPlugin = useCallback(async (pluginId: string, label: string) => {
    try {
      const pluginsRoot = host.getPluginsRoot();
      await downloadPluginBundle({
        pluginId,
        label,
        pluginsRoot,
        pluginDataRoot: PLUGIN_DATA_ROOT,
      });
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
      const pluginsRoot = host.getPluginsRoot();
      await deletePluginDirectories({
        pluginId: pendingDelete.pluginId,
        pluginsRoot,
        pluginDataRoot: PLUGIN_DATA_ROOT,
      });
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
        {visibleApps.map((app) => {
          const isRootFileApp = app.id.startsWith(ROOT_FILE_PREFIX);

          const renderContextMenu = () => {
            if (isRootFileApp) {
              return (
                <MenuItem
                  leftIcon={<Download size={16} />}
                  primaryLabel="Download file"
                  onClick={() => handleDownloadFile(app.id, app.title)}
                />
              );
            }

            const pluginId = getPluginIdFromAppId(app.id);
            const pluginLabel = host.getPluginDisplayName(pluginId) || pluginId;

            return (
              <>
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
              </>
            );
          };

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
                  <Menu.Content bg="background.primary">{renderContextMenu()}</Menu.Content>
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
        onDelete={handleConfirmDelete}
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
