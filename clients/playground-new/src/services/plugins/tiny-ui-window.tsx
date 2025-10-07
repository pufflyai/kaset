import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import { ls, readFile } from "@pstdio/opfs-utils";
import {
  getLockfile,
  registerVirtualSnapshot,
  setLockfile,
  TinyUI,
  unregisterVirtualSnapshot,
  type TinyUIStatus,
} from "@pstdio/tiny-ui";
import tinyUiRuntimeHtmlUrl from "@pstdio/tiny-ui/runtime.html?url";
import tinyUiServiceWorkerUrl from "@pstdio/tiny-ui/sw?url";
import { useEffect, useMemo, useState } from "react";
import { getPluginsRoot, subscribeToPluginFiles, type PluginDesktopWindowDescriptor } from "./plugin-host";

const GENERATED_TS_CONFIGS = new Set(["tsconfig.json", "tsconfig.app.json", "tsconfig.ui.json"]);

const SUPPORTED_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".sass", ".md"]);

const IGNORED_PREFIXES = ["node_modules/", "dist/", "build/", ".git/", ".turbo/", ".nx/", "out/"];

const DEFAULT_LOCKFILE: Record<string, string> = {
  react: "https://esm.sh/react@19.1.1/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.1/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.1/es2022/client.mjs",
  "react-dom": "https://esm.sh/react-dom@19.1.1/es2022/react-dom.mjs",
};

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

const shouldInclude = (path: string, entryPath: string) => {
  const normalized = toPosix(path);
  if (!normalized) return false;
  if (normalized === entryPath) return true;
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return SUPPORTED_FILE_EXTENSIONS.has(fileExtension(normalized));
};

const fileExtension = (path: string) => {
  const normalized = toPosix(path);
  const index = normalized.lastIndexOf(".");
  return index === -1 ? "" : normalized.slice(index);
};

const applyLockfile = (dependencies: Record<string, string>) => {
  const current = getLockfile() ?? {};
  setLockfile({
    ...DEFAULT_LOCKFILE,
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
  const [tinyStatus, setTinyStatus] = useState<TinyUIStatus>("idle");
  const [_error, setError] = useState<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [sourceRoot, setSourceRoot] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const entryPath = useMemo(() => sanitizeEntry(window.entry ?? ""), [window.entry]);
  const dependenciesKey = useMemo(() => JSON.stringify(window.dependencies ?? {}), [window.dependencies]);

  useEffect(() => {
    const manifestDeps = window.dependencies ?? {};
    applyLockfile(manifestDeps);
  }, [dependenciesKey, window.dependencies]);

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

    let cancelled = false;

    const loadSnapshot = async () => {
      setStatus("loading");
      setError(null);

      try {
        const entries = await ls(pluginRoot, { maxDepth: Infinity, kinds: ["file"] });
        const files: Record<string, string> = {};
        let tsconfig: string | null = null;

        for (const entry of entries) {
          const relativePath = toPosix(entry.path);

          if (GENERATED_TS_CONFIGS.has(relativePath)) {
            try {
              tsconfig = await readFile(`${pluginRoot}/${relativePath}`);
            } catch (tsError) {
              console.warn(`[tiny-ui] Failed to read tsconfig ${relativePath} for ${pluginId}`, tsError);
            }
            continue;
          }

          if (!shouldInclude(relativePath, entryPath)) continue;

          const opfsPath = `${pluginRoot}/${relativePath}`;
          try {
            const content = await readFile(opfsPath);
            files[`/${relativePath}`] = content;
          } catch (fileError) {
            console.warn(`[tiny-ui] Failed to read plugin file ${opfsPath}`, fileError);
          }

          if (cancelled) return;
        }

        if (!files[`/${entryPath}`]) {
          try {
            const content = await readFile(`${pluginRoot}/${entryPath}`);
            files[`/${entryPath}`] = content;
          } catch (entryError) {
            setError(entryError instanceof Error ? entryError.message : "Failed to read plugin entry");
            setStatus("error");
            return;
          }
        }

        registerVirtualSnapshot(pluginRoot, {
          entry: `/${entryPath}`,
          files,
          tsconfig,
        });

        if (cancelled) return;

        setSourceRoot(pluginRoot);
        setSnapshotVersion((value) => value + 1);
        setStatus("ready");
      } catch (loadError: any) {
        if (cancelled) return;
        console.error(`[tiny-ui] Failed to prepare snapshot for ${pluginId}`, loadError);
        setError(loadError?.message ?? "Failed to load plugin window");
        setStatus("error");
      }
    };

    loadSnapshot();

    return () => {
      cancelled = true;
      unregisterVirtualSnapshot(pluginRoot);
    };
  }, [pluginId, entryPath, refreshToken]);

  useEffect(() => {
    if (status === "error") {
      setTinyStatus("error");
    }
  }, [status]);

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
      </Center>
    );
  }

  console.log(sourceRoot, tinyStatus);

  return (
    <Box height="100%" width="100%" position="relative">
      <TinyUI
        key={`${pluginId}:${instanceId}:${snapshotVersion}`}
        src={sourceRoot}
        id={`${pluginId}:${instanceId}`}
        autoCompile
        runtimeSourceUrl={tinyUiRuntimeHtmlUrl}
        serviceWorkerUrl={tinyUiServiceWorkerUrl}
        onStatusChange={(next) => setTinyStatus(next)}
        onError={(tinyError) => {
          setError(tinyError.message);
          setStatus("error");
        }}
        onRuntimeError={(runtimeError) => {
          setError(runtimeError.message ?? "Plugin runtime failed");
          setStatus("error");
        }}
        showStatus={false}
        style={{ width: "100%", height: "100%" }}
      />
      {tinyStatus !== "ready" ? (
        <Center position="absolute" inset={0} backgroundColor="blackAlpha.700" color="white" pointerEvents="none">
          <Spinner />
        </Center>
      ) : null}
    </Box>
  );
};
