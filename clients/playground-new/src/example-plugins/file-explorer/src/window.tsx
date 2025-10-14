import { ChakraProvider, Flex, defaultSystem } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";
const CHANNEL_NAME = "file-explorer:open-folder";
const STATE_FILE = "state.json";
const textDecoder = new TextDecoder();

type OpenFileAction = (path: string, options?: { displayName?: string }) => Promise<void> | void;

interface DesktopHost {
  actions?: {
    openFile?: OpenFileAction;
  };
  fs?: {
    readFile?(path: string): Promise<Uint8Array>;
  };
}

interface FileExplorerWindowProps {
  host?: DesktopHost | null;
  onOpenFile?: OpenFileAction;
}

declare global {
  interface Window {
    __tinyUiHost__?: DesktopHost;
  }
}

const isMissingError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string };
  return candidate.code === "ENOENT" || candidate.name === "NotFoundError" || candidate.name === "NotFound";
};

function FileExplorerWindow(props: FileExplorerWindowProps) {
  const { host, onOpenFile } = props;
  const [_, setRequestedPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "open-folder") return;

      const path = (data as { path?: unknown }).path;
      if (typeof path === "string") {
        setRequestedPath(path);
      }
    };

    return () => {
      channel.onmessage = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    const readFile = host?.fs?.readFile;
    if (typeof readFile !== "function") return;

    let active = true;

    const loadLastPath = async () => {
      try {
        const bytes = await readFile(STATE_FILE);
        if (!active) return;

        const text = textDecoder.decode(bytes);
        const record = JSON.parse(text) as { lastOpenedFolder?: unknown };
        if (typeof record?.lastOpenedFolder === "string") {
          setRequestedPath(record.lastOpenedFolder);
        }
      } catch (error) {
        if (!isMissingError(error)) {
          console.warn("[file-explorer] Failed to read last opened folder", error);
        }
      }
    };

    loadLastPath().catch((error) => {
      if (!isMissingError(error)) {
        console.warn("[file-explorer] Failed to initialize last opened folder", error);
      }
    });

    return () => {
      active = false;
    };
  }, [host]);

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction="column">
      <FileExplorer rootDir={ROOT_DIR} onOpenFile={onOpenFile} />
    </Flex>
  );
}

export function mount(container: Element | null, host?: DesktopHost | null) {
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
