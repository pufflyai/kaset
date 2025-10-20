import { host, type PluginSurfacesSnapshot } from "@/services/plugins/host";
import { deriveDesktopSurfaces, type PluginDesktopSurface } from "@/services/plugins/surfaces";
import { subscribeToPluginFiles, type PluginFilesChange } from "@pstdio/tiny-plugins";
import { loadSourceFiles } from "@pstdio/tiny-ui";
import { useEffect } from "react";

const buildPluginRoot = (pluginsRoot: string, pluginId: string) => {
  const trimmedRoot = pluginsRoot.replace(/^\/+|\/+$/g, "");
  return trimmedRoot ? `/${trimmedRoot}/${pluginId}` : `/${pluginId}`;
};

export const usePluginSources = () => {
  useEffect(() => {
    let disposed = false;

    const surfacesRef = new Map<string, { surfaces: PluginDesktopSurface[]; signature: string }>();
    const reloadQueue = new Set<string>();
    const pendingLoads = new Map<string, Promise<void>>();

    const createSignature = (surfaces: PluginDesktopSurface[]) => JSON.stringify(surfaces);

    const syncSnapshot = (snapshot: PluginSurfacesSnapshot) => {
      const changed = new Set<string>();
      const nextMap = new Map<string, PluginDesktopSurface[]>();
      snapshot.forEach((entry) => {
        const displayName = host.getPluginDisplayName(entry.pluginId) || entry.pluginId;
        const derived = deriveDesktopSurfaces({
          pluginId: entry.pluginId,
          surfaces: entry.surfaces,
          manifest: host.getPluginManifest(entry.pluginId),
          displayName,
        }).filter((surface) => Boolean(surface.window?.entry));
        if (derived.length > 0) {
          nextMap.set(entry.pluginId, derived);
        }
      });

      const remaining = new Set(surfacesRef.keys());

      nextMap.forEach((list, pluginId) => {
        const signature = createSignature(list);
        const existing = surfacesRef.get(pluginId);
        if (!existing || existing.signature !== signature) {
          surfacesRef.set(pluginId, { surfaces: list, signature });
          if (list.length > 0) {
            changed.add(pluginId);
          }
        }
        remaining.delete(pluginId);
      });

      remaining.forEach((pluginId) => {
        surfacesRef.delete(pluginId);
        reloadQueue.delete(pluginId);
        pendingLoads.delete(pluginId);
      });

      return changed;
    };

    const loadPluginSources = async (pluginId: string) => {
      const record = surfacesRef.get(pluginId);
      const surfaces = record?.surfaces;
      if (!surfaces || surfaces.length === 0) return;

      const pluginsRoot = host.getPluginsRoot();
      const pluginRoot = buildPluginRoot(pluginsRoot, pluginId);

      const tasks = surfaces
        .map((surface) => {
          const entry = surface.window?.entry?.trim();
          if (!entry) return null;

          const entrypoint = `/${entry.replace(/^\/+/, "")}`;
          const sourceId = `${surface.pluginId}:${surface.surfaceId}`;

          return loadSourceFiles({ id: sourceId, root: pluginRoot, entrypoint });
        })
        .filter((task): task is Promise<void> => Boolean(task));

      if (tasks.length === 0) return;

      try {
        await Promise.all(tasks);
      } catch (error) {
        console.warn(`[usePluginSources] Failed to load sources for ${pluginId}`, error);
      }
    };

    const scheduleLoad = (pluginId: string) => {
      if (disposed) return;

      if (!surfacesRef.has(pluginId)) {
        reloadQueue.delete(pluginId);
        return;
      }

      if (pendingLoads.has(pluginId)) {
        reloadQueue.add(pluginId);
        return;
      }

      const loadTask = loadPluginSources(pluginId).finally(() => {
        pendingLoads.delete(pluginId);
        if (reloadQueue.has(pluginId)) {
          reloadQueue.delete(pluginId);
          scheduleLoad(pluginId);
        }
      });

      pendingLoads.set(pluginId, loadTask);
    };

    const initialChanges = syncSnapshot(host.getPluginSurfaces());
    initialChanges.forEach((pluginId) => {
      scheduleLoad(pluginId);
    });

    const unsubscribeSurfaces = host.subscribeToPluginSurfaces((snapshot) => {
      if (disposed) return;
      const changed = syncSnapshot(snapshot);
      changed.forEach((pluginId) => {
        scheduleLoad(pluginId);
      });
    });

    let unsubscribeFiles: (() => void) | null = null;

    host
      .ensureHost()
      .then((instance) => {
        if (disposed) return;
        unsubscribeFiles = subscribeToPluginFiles(instance, (changes: PluginFilesChange[]) => {
          if (disposed) return;
          const affected = new Set<string>();

          changes.forEach((change) => {
            affected.add(change.pluginId);
          });

          affected.forEach((pluginId) => {
            scheduleLoad(pluginId);
          });
        });
      })
      .catch((error) => {
        console.warn("[usePluginSources] Failed to attach plugin file subscription", error);
      });

    return () => {
      disposed = true;
      reloadQueue.clear();
      pendingLoads.clear();
      unsubscribeSurfaces();
      unsubscribeFiles?.();
    };
  }, []);
};
