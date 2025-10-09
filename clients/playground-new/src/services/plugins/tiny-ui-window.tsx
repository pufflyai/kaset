import { toaster } from "@/components/ui/toaster";
import { ROOT } from "@/constant";
import { Box, Button, Center, Spinner, Text } from "@chakra-ui/react";
import {
  createWorkspaceFs,
  getLockfile,
  loadSnapshot,
  setLockfile,
  TinyUI,
  unregisterVirtualSnapshot,
} from "@pstdio/tiny-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMergedPluginDependencies,
  getPluginsRoot,
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

const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
const runtimeUrl = `${import.meta.env.BASE_URL}tiny-ui/runtime.html`;

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
  const refreshToken = usePluginFilesRefresh(pluginId);
  const workspaceFs = useMemo(() => createWorkspaceFs(ROOT), []);

  const notify = useCallback((level: "info" | "warn" | "error", message: string) => {
    const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
    toaster.create({ type, title: message, duration: 5000 });
  }, []);

  const entryPath = pluginWindow.entry;

  useEffect(() => {
    applyLockfile(getMergedPluginDependencies());
  }, []);

  useEffect(() => {
    if (!entryPath) {
      setError("Plugin window entry path is invalid.");
      setStatus("error");
      return undefined;
    }

    const pluginsRoot = getPluginsRoot();
    const pluginRoot = buildPluginRoot(pluginsRoot, pluginId);
    const snapshotRoot = `/${pluginRoot}`;

    let cancelled = false;

    const refreshSnapshot = async () => {
      setStatus("loading");
      setError(null);

      try {
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
  }, [pluginId, entryPath, refreshToken]);

  if (status === "loading" || status === "idle") {
    return (
      <Center height="100%" width="100%">
        <Spinner />
      </Center>
    );
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

  const pluginsRoot = getPluginsRoot();
  // one plugin might have bundled code for multiple surfaces
  const sourceId = `${pluginId}:${surfaceId}`;
  // we remount the component if the snapshotVersion changes
  // this way if the UI changes we get a fresh iframe and TinyUI instance
  const key = `${pluginId}:${instanceId}:${snapshotVersion}`;

  return (
    <Box height="100%" width="100%" position="relative">
      <TinyUI
        key={key}
        instanceId={instanceId}
        sourceId={sourceId}
        root={sourceRoot}
        skipCache={refreshToken > 0}
        autoCompile
        serviceWorkerUrl={serviceWorkerUrl}
        runtimeUrl={runtimeUrl}
        onError={(tinyError) => {
          setError(tinyError.message);
          setStatus("error");
        }}
        bridge={{
          pluginId,
          pluginsRoot,
          workspaceFs,
          notify,
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </Box>
  );
};
