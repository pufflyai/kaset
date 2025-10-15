import { ChakraProvider, Flex, Text, defaultSystem } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";
import type { WorkspaceHost } from "./hooks/fs";

const ROOT_DIR = "playground";
const CHANNEL_NAME = "file-explorer:open-folder";

type OpenFileAction = (path: string, options?: { displayName?: string }) => Promise<void> | void;

interface FileExplorerHost extends WorkspaceHost {
  actions?: {
    openFile?: OpenFileAction;
  };
  settings?: {
    read?(): Promise<unknown>;
  };
}

interface FileExplorerWindowProps {
  host: FileExplorerHost | null;
  onOpenFile?: OpenFileAction;
}

declare global {
  interface Window {
    __tinyUiHost__?: FileExplorerHost | null;
  }
}

function FileExplorerWindow(props: FileExplorerWindowProps) {
  const { host, onOpenFile } = props;
  const [requestedPath, setRequestedPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "open-folder") return;

      const path = (data as { path?: unknown }).path;
      if (typeof path === "string") setRequestedPath(path);
    };

    return () => {
      channel.onmessage = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    const readSettings = host?.settings?.read;
    if (typeof readSettings !== "function") return;

    let active = true;

    const loadLastPath = async () => {
      try {
        const record = (await readSettings()) as { lastOpenedFolder?: unknown } | null | undefined;
        if (!active) return;

        if (typeof record?.lastOpenedFolder === "string") setRequestedPath(record.lastOpenedFolder);
      } catch (error) {
        console.warn("[file-explorer] Failed to read last opened folder", error);
      }
    };

    loadLastPath().catch((error) => {
      console.warn("[file-explorer] Failed to initialize last opened folder", error);
    });

    return () => {
      active = false;
    };
  }, [host]);

  if (!host) {
    return (
      <Flex height="100%" bg="background.dark" color="foreground.inverse" align="center" justify="center" padding="6">
        <Text fontSize="sm" color="foreground.subtle" textAlign="center">
          Tiny UI host is not available for the File Explorer plugin.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction="column">
      <FileExplorer host={host} rootDir={ROOT_DIR} requestedPath={requestedPath} onOpenFile={onOpenFile} />
    </Flex>
  );
}

export function mount(container: Element | null, host?: FileExplorerHost | null) {
  if (!container) throw new Error("file-explorer mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);
  const resolvedHost = host ?? window.__tinyUiHost__ ?? null;
  const openFileAction = resolvedHost?.actions?.openFile;
  console.info("[file-explorer] Mounting window", {
    hasHost: Boolean(resolvedHost),
    hasOpenFileAction: typeof openFileAction === "function",
    hostKeys: resolvedHost ? Object.keys(resolvedHost) : null,
  });
  console.info("[file-explorer] Host received", resolvedHost);

  root.render(
    <ChakraProvider value={defaultSystem}>
      <FileExplorerWindow host={resolvedHost} onOpenFile={openFileAction} />
    </ChakraProvider>,
  );

  return () => {
    console.info("[file-explorer] Unmounting window");
    root.unmount();
  };
}
