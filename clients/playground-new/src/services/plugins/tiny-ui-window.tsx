import { LoadingState } from "@/components/ui/loading-state";
import { toaster } from "@/components/ui/toaster";
import { ROOT } from "@/constant";
import { requestOpenDesktopFile } from "@/services/desktop/fileApps";
import { Box, Button, Center, Text } from "@chakra-ui/react";
import { TinyUI, loadSnapshot, setupTinyUI, type TinyUIActionHandler, type TinyUIStatus } from "@pstdio/tiny-ui";
import { getLockfile, registerSources, setLockfile, unregisterVirtualSnapshot } from "@pstdio/tiny-ui-bundler";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMergedPluginDependencies,
  getPluginsRoot,
  subscribeToPluginFiles,
  type PluginDesktopWindowDescriptor,
} from "./plugin-host";
import { createTinyUiOpsHandler, type TinyUiOpsRequest } from "./tinyUiOps";
import { createWorkspaceFs } from "./workspaceFs";

type Status = "idle" | "loading" | "ready" | "error";

export interface PluginTinyUiWindowProps {
  pluginId: string;
  surfaceId: string;
  instanceId: string;
  pluginWindow: PluginDesktopWindowDescriptor;
}

const buildAssetUrl = (path: string) => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

const serviceWorkerUrl = buildAssetUrl("sw.js");
const runtimeUrl = buildAssetUrl("tiny-ui/runtime.html");

const buildPluginRoot = (pluginsRoot: string, pluginId: string) => {
  const normalized = pluginsRoot.replace(/\/+$/, "");
  return normalized ? `${normalized}/${pluginId}` : pluginId;
};

const applyLockfile = (dependencies: Record<string, string>) => {
  const current = getLockfile() ?? {};
  setLockfile({
    ...current,
    ...dependencies,
  });
};

// usePluginFilesRefresh returns a counter that ticks whenever the plugin's files change on disk.
const usePluginFilesRefresh = (pluginId: string) => {
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const timerRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    const scheduleRefresh = () => {
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setRefreshToken((value) => value + 1);
      }, 150);
    };

    const unsubscribe = subscribeToPluginFiles(pluginId, scheduleRefresh);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      unsubscribe();
    };
  }, [pluginId]);

  return refreshToken;
};

export const PluginTinyUiWindow = (props: PluginTinyUiWindowProps) => {
  const { pluginId, pluginWindow, surfaceId, instanceId } = props;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [sourceRoot, setSourceRoot] = useState<string | null>(null);
  const [tinyStatus, setTinyStatus] = useState<TinyUIStatus>("initializing");
  const refreshToken = usePluginFilesRefresh(pluginId);
  const workspaceFs = useMemo(() => createWorkspaceFs(ROOT), []);
  const pluginsRoot = useMemo(() => getPluginsRoot(), []);
  const sourceId = `${pluginId}:${surfaceId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setupTinyUI({ serviceWorkerUrl, runtimeUrl }).catch((reason) => {
      const message =
        reason instanceof Error ? reason.message : "Tiny UI service worker failed to initialize for this window.";
      console.error("[tiny-ui-window] Failed to initialize Tiny UI", reason);
      setError(message);
      setStatus("error");
    });
  }, []);

  const handleTinyStatusChange = useCallback((nextStatus: TinyUIStatus) => {
    if (nextStatus === "error") return;
    setTinyStatus(nextStatus);
  }, []);

  const handleTinyError = useCallback((tinyError: Error) => {
    setError(tinyError.message);
    setStatus("error");
  }, []);

  const notify = useCallback((level: "info" | "warn" | "error", message: string) => {
    const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
    toaster.create({ type, title: message, duration: 5000 });
  }, []);

  const handleOpenFile = useCallback(
    async (path: string, options?: { displayName?: string }) => {
      console.info("[tiny-ui-window] Forwarding open file request to desktop", { pluginId, path, options });
      requestOpenDesktopFile(path, options);
    },
    [pluginId],
  );

  const forwardRequest = useCallback(
    async (request: TinyUiOpsRequest) => {
      console.info("[tiny-ui-window] Received Tiny UI request", {
        pluginId,
        method: request.method,
        params: request.params,
      });
      if (request.method === "actions.openFile") {
        const rawParams = request.params;
        let path: string | undefined;
        let displayName: string | undefined;

        if (typeof rawParams === "string") {
          path = rawParams;
        } else if (rawParams && typeof rawParams === "object") {
          const record = rawParams as Record<string, unknown>;
          if (typeof record.path === "string") {
            path = record.path;
          } else if (Array.isArray(record.args) && typeof record.args[0] === "string") {
            path = record.args[0];
            const maybeDisplayName = record.args[1];
            if (maybeDisplayName && typeof maybeDisplayName.displayName === "string") {
              displayName = maybeDisplayName.displayName;
            }
          } else if (typeof record.value === "string") {
            path = record.value;
          }

          if (typeof record.displayName === "string") {
            displayName = record.displayName;
          }
        }

        if (!path || !path.trim()) {
          throw new Error("actions.openFile requires params.path");
        }
        await handleOpenFile(path, displayName ? { displayName } : undefined);
        return { ok: true };
      }

      throw new Error(`Unknown Tiny UI host request: ${request.method}`);
    },
    [handleOpenFile, pluginId],
  );

  const entryPath = pluginWindow.entry;
  const opsHandler = useMemo(
    () =>
      createTinyUiOpsHandler({
        pluginId,
        pluginsRoot,
        workspaceFs,
        notify,
        forwardRequest,
      }),
    [pluginId, pluginsRoot, workspaceFs, notify, forwardRequest],
  );

  const handleActionCall = useCallback<TinyUIActionHandler>(
    (method, params) => opsHandler({ method, params }),
    [opsHandler],
  );
  const tinyUiStyle = useMemo(
    () => ({
      width: "100%",
      height: "100%",
    }),
    [],
  );

  useEffect(() => {
    applyLockfile(getMergedPluginDependencies());
  }, []);

  useEffect(() => {
    if (!entryPath) {
      setError("Plugin window entry path is invalid.");
      setStatus("error");
      return undefined;
    }

    const pluginRoot = buildPluginRoot(pluginsRoot, pluginId);
    const snapshotRoot = `/${pluginRoot}`;

    let cancelled = false;

    const refreshSnapshot = async () => {
      setStatus("loading");
      setError(null);

      try {
        registerSources([{ id: sourceId, root: snapshotRoot }]);
        await loadSnapshot(pluginRoot, `/${entryPath}`);

        if (cancelled) return;

        setSourceRoot(snapshotRoot);
        setSnapshotVersion((value) => value + 1);
        setStatus("ready");
      } catch (loadError: any) {
        if (cancelled) return;
        console.error(`[tiny-ui] Failed to prepare snapshot for ${pluginId}`, loadError);
        setError(loadError?.message ?? "Failed to load plugin window");
        setStatus("error");
      }
    };

    refreshSnapshot();

    return () => {
      cancelled = true;
      unregisterVirtualSnapshot(snapshotRoot);
    };
  }, [entryPath, pluginId, pluginsRoot, refreshToken, sourceId]);

  useEffect(() => {
    setTinyStatus("initializing");
  }, [snapshotVersion]);

  if (status === "loading" || status === "idle") {
    return null;
  }

  if (status === "error" || !sourceRoot) {
    return (
      <Center height="100%" width="100%" padding="md">
        <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
          <Text fontSize="sm">Failed to load plugin window:</Text>
          {error ? (
            <Box marginTop="3">
              <Text fontSize="xs">{error}</Text>
              <Button
                marginTop="3"
                size="xs"
                variant="solid"
                onClick={() => {
                  navigator.clipboard.writeText(error);
                }}
              >
                Copy error message
              </Button>
            </Box>
          ) : null}
        </Box>
      </Center>
    );
  }

  // we remount the component if the snapshotVersion changes
  // this way if the UI changes we get a fresh iframe and TinyUI instance
  const key = `${pluginId}:${instanceId}:${snapshotVersion}`;
  const isLoadingOverlayActive = tinyStatus === "compiling" || tinyStatus === "initializing";

  return (
    <Box height="100%" width="100%" position="relative">
      <TinyUI
        key={key}
        instanceId={instanceId}
        sourceId={sourceId}
        skipCache={refreshToken > 0}
        autoCompile
        onStatusChange={handleTinyStatusChange}
        onError={handleTinyError}
        onActionCall={handleActionCall}
        style={tinyUiStyle}
      />
      <Center
        background="background.primary"
        position="absolute"
        inset={0}
        zIndex={1}
        pointerEvents={isLoadingOverlayActive ? "all" : "none"}
        display={isLoadingOverlayActive ? "flex" : "none"}
      >
        <LoadingState title={tinyStatus} />
      </Center>
    </Box>
  );
};
