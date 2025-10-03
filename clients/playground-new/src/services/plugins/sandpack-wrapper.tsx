import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import { SandpackLayout, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import { useEffect, useMemo, useState } from "react";
import { ls, readFile } from "@pstdio/opfs-utils";
import {
  getPluginsRoot,
  subscribeToPluginFiles,
  type PluginDesktopWindowDescriptor,
} from "@/services/plugins/plugin-host";

const GENERATED_ENTRY_PATH = "/__kaset_entry__.tsx";

const SUPPORTED_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".sass", ".md"]);

const IGNORED_PREFIXES = ["node_modules/", "dist/", "build/", ".git/", ".turbo/", ".nx/", "out/"];

const DEFAULT_SANDBOX_DEPENDENCIES: Record<string, string> = {
  react: "19.1.1",
  "react-dom": "19.1.1",
  "@chakra-ui/react": "3.24.2",
  "@emotion/react": "11.14.0",
  "@emotion/styled": "11.14.0",
  "lucide-react": "0.542.0",
  "@pstdio/opfs-utils": "0.1.6",
  "@pstdio/prompt-utils": "0.1.1",
  zustand: "5.0.8",
};

type Status = "idle" | "loading" | "ready" | "error";

export interface PluginSandpackWindowProps {
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

const fileExtension = (path: string) => {
  const normalized = toPosix(path);
  const index = normalized.lastIndexOf(".");
  return index === -1 ? "" : normalized.slice(index);
};

const shouldInclude = (path: string, entryPath: string) => {
  const normalized = toPosix(path);
  if (!normalized) return false;
  if (normalized === entryPath) return true;
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return SUPPORTED_FILE_EXTENSIONS.has(fileExtension(normalized));
};

const createGeneratedEntry = (entryPath: string) => `import React from "react";
import ReactDOM from "react-dom/client";
import * as Module from "./${entryPath}";

const mount = document.getElementById("root");

if (!mount) {
  throw new Error("Kaset plugin window is missing a root element");
}

const resolveComponent = () => {
  if (Module && typeof Module.default === "function") return Module.default;
  const candidates = Object.values(Module).filter((value) => typeof value === "function");
  return candidates.length > 0 ? (candidates[0] as React.ComponentType) : null;
};

const Component = resolveComponent();
const root = ReactDOM.createRoot(mount);

if (Component) {
  root.render(React.createElement(Component));
} else {
  const exported = Object.keys(Module);
  root.render(
    React.createElement(
      "div",
      { style: { padding: "1rem", fontFamily: "sans-serif", color: "#f00" } },
      "Module ${entryPath} did not export a React component. Exports: " + (exported.join(", ") || "(none)"),
    ),
  );
}
`;

export const PluginSandpackWindow = (props: PluginSandpackWindowProps) => {
  const { pluginId, window, instanceId } = props;
  const [status, setStatus] = useState<Status>("idle");
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const entryPath = useMemo(() => sanitizeEntry(window.entry), [window.entry]);

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
      setStatus("error");
      setError("Plugin window entry path is invalid.");
      return;
    }

    let cancelled = false;

    const loadFiles = async () => {
      setStatus("loading");
      setError(null);

      try {
        const root = getPluginsRoot().replace(/\/+$/, "");
        const pluginRoot = `${root}/${pluginId}`;
        const entries = await ls(pluginRoot, { maxDepth: Infinity, kinds: ["file"] });
        const nextFiles: Record<string, string> = {};

        for (const entry of entries) {
          const relativePath = toPosix(entry.path);
          if (!shouldInclude(relativePath, entryPath)) continue;

          const opfsPath = `${pluginRoot}/${relativePath}`;
          try {
            const content = await readFile(opfsPath);
            nextFiles[`/${relativePath}`] = content;
          } catch (readError) {
            console.warn(`[plugin-host] Failed to read plugin file ${opfsPath}`, readError);
          }

          if (cancelled) return;
        }

        if (!nextFiles[`/${entryPath}`]) {
          const content = await readFile(`${pluginRoot}/${entryPath}`);
          nextFiles[`/${entryPath}`] = content;
        }

        nextFiles[GENERATED_ENTRY_PATH] = createGeneratedEntry(entryPath);

        if (!cancelled) {
          setFiles(nextFiles);
          setStatus("ready");
        }
      } catch (loadError: any) {
        if (cancelled) return;
        console.error(`[plugin-host] Failed to load sandpack files for ${pluginId}`, loadError);
        setError(loadError?.message ?? "Failed to load plugin window");
        setStatus("error");
      }
    };

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [pluginId, entryPath, refreshToken]);

  const dependencies = useMemo(() => {
    const manifestDeps = window.dependencies ?? {};
    return {
      ...DEFAULT_SANDBOX_DEPENDENCIES,
      ...manifestDeps,
      react: DEFAULT_SANDBOX_DEPENDENCIES.react,
      "react-dom": DEFAULT_SANDBOX_DEPENDENCIES["react-dom"],
    };
  }, [window.dependencies]);

  if (status === "loading" || status === "idle") {
    return (
      <Center height="100%" width="100%">
        <Spinner />
      </Center>
    );
  }

  if (status === "error" || !files) {
    return (
      <Center height="100%" width="100%" padding="md">
        <Text fontSize="sm" textAlign="center">
          {error ?? "Failed to load plugin window"}
        </Text>
      </Center>
    );
  }

  return (
    <Box key={instanceId} height="100%" width="100%" overflow="hidden">
      <SandpackProvider
        key={`${pluginId}:${instanceId}`}
        template="react-ts"
        files={files}
        style={{ height: "100%" }}
        customSetup={{ dependencies, entry: GENERATED_ENTRY_PATH }}
        options={{ activeFile: `/${entryPath}`, autorun: true }}
      >
        <SandpackLayout style={{ height: "100%" }}>
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton={false} style={{ height: "100%" }} />
        </SandpackLayout>
      </SandpackProvider>
    </Box>
  );
};
