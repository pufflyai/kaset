import { ChakraProvider, Flex, defaultSystem } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FsScope, TinyUiHost } from "./host";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";
const CHANNEL_NAME = "file-explorer:open-folder";
const ROOT_SCOPE: FsScope = "workspace";

type OpenFileAction = (path: string, options?: { displayName?: string }) => Promise<void> | void;

interface FileExplorerWindowProps {
  host: TinyUiHost;
  onOpenFile?: OpenFileAction;
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

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction="column">
      <FileExplorer
        host={host}
        rootDir={ROOT_DIR}
        scope={ROOT_SCOPE}
        requestedPath={requestedPath}
        onOpenFile={onOpenFile}
      />
    </Flex>
  );
}

export function mount(container: Element | null, host?: TinyUiHost | null) {
  if (!container) throw new Error("file-explorer mount target is not available");
  if (!host) throw new Error("file-explorer requires the Tiny UI host bridge");

  const openFileAction = (path: string) => {
    host.call("desktop.openFilePreview", { path }).catch(() => undefined);
  };

  const target = container;
  target.innerHTML = "";

  const root = createRoot(target);
  root.render(
    <ChakraProvider value={defaultSystem}>
      <FileExplorerWindow host={host} onOpenFile={openFileAction} />
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
