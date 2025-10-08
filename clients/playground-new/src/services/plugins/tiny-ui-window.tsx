import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import {
  createWorkspaceFs,
  getLockfile,
  loadSnapshot,
  setLockfile,
  TinyUI,
  unregisterVirtualSnapshot,
} from "@pstdio/tiny-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import { ROOT } from "@/constant";
import {
  getMergedPluginDependencies,
  getPluginsRoot,
  subscribeToPluginDependencies,
  subscribeToPluginFiles,
  type PluginDesktopWindowDescriptor,
} from "./plugin-host";

type Status = "idle" | "loading" | "ready" | "error";

export interface PluginTinyUiWindowProps {
  pluginId: string;
  instanceId: string;
  window: PluginDesktopWindowDescriptor;
}

const toPosix = (value: string) => value.replace(/\\/g, "/");

const sanitizeEntry = (entry: string) => {
  const normalized = toPosix(entry).replace(/^\/+/, "");
  const segments = normalized.split("/").filter((segment) => segment && segment !== "..");
  return segments.join("/");
};

const applyLockfile = (dependencies: Record<string, string>) => {
  const current = getLockfile() ?? {};
  setLockfile({
    ...current,
    ...dependencies,
  });
};

const buildPluginRoot = (pluginsRoot: string, pluginId: string) => {
  const normalized = pluginsRoot.replace(/\/+$/, "");
  return normalized ? `${normalized}/${pluginId}` : pluginId;
};

export const PluginTinyUiWindow = (props: PluginTinyUiWindowProps) => {
  const { pluginId, window, instanceId } = props;
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [sourceRoot, setSourceRoot] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [globalDependencies, setGlobalDependencies] = useState<Record<string, string>>(() =>
    getMergedPluginDependencies(),
  );
  const workspaceFs = useMemo(() => createWorkspaceFs(ROOT), []);
  const notify = useCallback((level: "info" | "warn" | "error", message: string) => {
    const type = level === "error" ? "error" : level === "warn" ? "warning" : "info";
    toaster.create({ type, title: message, duration: 5000 });
  }, []);

  const entryPath = useMemo(() => sanitizeEntry(window.entry ?? ""), [window.entry]);
  useEffect(() => {
    setGlobalDependencies(getMergedPluginDependencies());
    const unsubscribe = subscribeToPluginDependencies((deps) => {
      setGlobalDependencies({ ...deps });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const dependencySnapshot = useMemo(() => {
    const manifestDependencies = window.dependencies ?? {};
    return { ...globalDependencies, ...manifestDependencies };
  }, [globalDependencies, window.dependencies]);

  useEffect(() => {
    applyLockfile(dependencySnapshot);
  }, [dependencySnapshot]);

  useEffect(() => {
    const unsubscribe = subscribeToPluginFiles(pluginId, () => {
      setRefreshToken((value) => value + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [pluginId]);

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
        <Text fontSize="sm" textAlign="center">
          Failed to load plugin window
        </Text>
        {error ? (
          <Text fontSize="xs" marginTop="2" textAlign="center">
            {error}
          </Text>
        ) : null}
      </Center>
    );
  }

  const pluginsRoot = getPluginsRoot();

  return (
    <Box height="100%" width="100%" position="relative">
      <TinyUI
        key={`${pluginId}:${instanceId}:${snapshotVersion}`}
        root={sourceRoot}
        id={`${pluginId}:${instanceId}`}
        autoCompile
        serviceWorkerUrl={"/sw.js"}
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
