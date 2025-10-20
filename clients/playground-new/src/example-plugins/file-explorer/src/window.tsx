import { ChakraProvider, Flex, defaultSystem } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";
const CHANNEL_NAME = "file-explorer:open-folder";

type OpenFileAction = (path: string, options?: { displayName?: string }) => Promise<void> | void;

interface DesktopHost {
  call: (actionId: string, payload: any) => Promise<any>;
}

interface FileExplorerWindowProps {
  onOpenFile?: OpenFileAction;
}

function FileExplorerWindow(props: FileExplorerWindowProps) {
  const { onOpenFile } = props;
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
      <FileExplorer rootDir={ROOT_DIR} requestedPath={requestedPath} onOpenFile={onOpenFile} />
    </Flex>
  );
}

export function mount(container: Element | null, host?: DesktopHost | null) {
  if (!container) throw new Error("file-explorer mount target is not available");

  const openFileAction = (path: string) => {
    host?.call("desktop.openFilePreview", { path });
  };

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(
    <ChakraProvider value={defaultSystem}>
      <FileExplorerWindow onOpenFile={openFileAction} />
    </ChakraProvider>,
  );

  return () => {
    console.info("[file-explorer] Unmounting window");
    root.unmount();
  };
}
