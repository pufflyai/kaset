import { LoadingState } from "@/components/ui/loading-state";
import { Box, Button, Center, Text } from "@chakra-ui/react";
import { TinyUI, loadSnapshot, type TinyUIActionHandler, type TinyUIStatus } from "@pstdio/tiny-ui";
import { getLockfile, registerSources, setLockfile, unregisterVirtualSnapshot } from "@pstdio/tiny-ui-bundler";
import { createUiOpsAdapter } from "@pstdio/tiny-plugins";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMergedPluginDependencies,
  getPluginsRoot,
  ensurePluginHost,
  subscribeToPluginFiles,
  type PluginDesktopWindowDescriptor,
} from "./plugin-host";

type Status = "idle" | "loading" | "ready" | "error";

export interface PluginTinyUiWindowProps {
  pluginId: string;
  surfaceId: string;
  instanceId: string;
  pluginWindow: PluginDesktopWindowDescriptor;
}

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

const LOADING_STATUSES: TinyUIStatus[] = ["initializing", "service-worker-ready", "compiling", "handshaking"];

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
  const [opsHandler, setOpsHandler] = useState<
    ((method: string, params?: Record<string, unknown>) => Promise<unknown>) | null
  >(null);
  const refreshToken = usePluginFilesRefresh(pluginId);
  const pluginsRoot = useMemo(() => getPluginsRoot(), []);
  const sourceId = `${pluginId}:${surfaceId}`;

  const handleTinyStatusChange = useCallback((nextStatus: TinyUIStatus) => {
    if (nextStatus === "error") return;
    setTinyStatus(nextStatus);
  }, []);

  const handleTinyError = useCallback((tinyError: Error) => {
    setError(tinyError.message);
    setStatus("error");
  }, []);

  const entryPath = pluginWindow.entry;
  const handleActionCall = useCallback<TinyUIActionHandler>(
    (method, params) => {
      if (!opsHandler) {
        throw new Error("Plugin host not ready");
      }
      return opsHandler(method, params as Record<string, unknown> | undefined);
    },
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
    let cancelled = false;
    (async () => {
      try {
        const host = await ensurePluginHost();
        const hostApi = host.createHostApiFor(pluginId);
        const uiOps = createUiOpsAdapter({ hostApi });
        if (!cancelled) {
          setOpsHandler(
            () => (method: string, params?: Record<string, unknown>) => uiOps({ method, params }),
          );
        }
      } catch (err) {
        console.error("[tiny-ui-window] Failed to initialize plugin host", err);
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to initialize plugin host";
        setError(message);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      setOpsHandler(null);
    };
  }, [pluginId]);

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
  const isLoadingOverlayActive = LOADING_STATUSES.includes(tinyStatus);

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
