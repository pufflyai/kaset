import { Box, Text } from "@chakra-ui/react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PluginTinyUiWindow } from "@/services/plugins/tiny-ui-window";
import { openDesktopApp } from "@/state/actions/desktop";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { DesktopApp, Size } from "@/state/types";
import {
  ensurePluginHost,
  subscribeToPluginDesktopSurfaces,
  type PluginDesktopSurface,
} from "@/services/plugins/plugin-host";
import { DesktopIcon } from "./desktop-icon";
import { WindowHost } from "./window-host";

const FALLBACK_ICON: LucideIcon =
  (LucideIcons.ListTodoIcon as LucideIcon | undefined) ??
  (LucideIcons.AppWindow as LucideIcon | undefined) ??
  (LucideIcons.Square as LucideIcon | undefined) ??
  (LucideIcons.Box as LucideIcon | undefined) ??
  (LucideIcons.Circle as LucideIcon | undefined) ??
  ((() => null) as unknown as LucideIcon);

const ICON_CACHE = new Map<string, LucideIcon>();

const DEFAULT_WINDOW_SIZE = { width: 840, height: 620 };
const DEFAULT_MIN_WINDOW_SIZE = { width: 420, height: 320 };

const resolveIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return FALLBACK_ICON!;

  const cached = ICON_CACHE.get(iconName);
  if (cached) return cached;

  const source = (LucideIcons as Record<string, unknown>)[iconName];
  if (typeof source === "function") {
    const icon = source as LucideIcon;
    ICON_CACHE.set(iconName, icon);
    return icon;
  }

  const alternativeName = `${iconName}Icon`;
  const altSource = (LucideIcons as Record<string, unknown>)[alternativeName];
  if (typeof altSource === "function") {
    const icon = altSource as LucideIcon;
    ICON_CACHE.set(iconName, icon);
    return icon;
  }

  ICON_CACHE.set(iconName, FALLBACK_ICON!);
  return FALLBACK_ICON!;
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

  return <PluginTinyUiWindow pluginId={surface.pluginId} instanceId={windowId} window={descriptor} />;
};

const createDesktopAppFromSurface = (surface: PluginDesktopSurface): DesktopApp => {
  const icon = resolveIcon(surface.icon);
  const defaultSize = normalizeSize(surface.defaultSize, DEFAULT_WINDOW_SIZE);
  const minSize = normalizeSize(surface.minSize, DEFAULT_MIN_WINDOW_SIZE);
  const defaultPosition = normalizePosition(surface.defaultPosition);
  const description = surface.description ?? `Surface provided by ${surface.pluginId}`;
  const singleton = surface.singleton ?? true;

  const app: DesktopApp = {
    id: `${surface.pluginId}/${surface.surfaceId}`,
    title: surface.title,
    icon,
    description,
    defaultSize,
    minSize,
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
        justifyItems="start"
        gridTemplateColumns="repeat(auto-fit, minmax(8rem, max-content))"
      >
        {apps.map((app) => (
          <DesktopIcon
            key={app.id}
            icon={app.icon}
            label={app.title}
            isSelected={selectedAppId === app.id}
            onSelect={() => handleSelectApp(app.id)}
            onFocus={() => handleSelectApp(app.id)}
            onOpen={() => handleOpenApp(app.id)}
          />
        ))}
      </Box>
      <WindowHost windows={windows} containerSize={containerSize} getAppById={getAppById} />
    </Box>
  );
};
