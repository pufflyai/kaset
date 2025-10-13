import { ChakraProvider, Flex, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";

type OpenFileAction = (path: string, options?: { displayName?: string }) => Promise<void> | void;

interface DesktopHost {
  actions?: {
    openFile?: OpenFileAction;
  };
}

interface FileExplorerWindowProps {
  onOpenFile?: OpenFileAction;
}

function FileExplorerWindow(props: FileExplorerWindowProps) {
  const { onOpenFile } = props;

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
  const openFileAction = host?.actions?.openFile;

  root.render(
    <ChakraProvider value={defaultSystem}>
      <FileExplorerWindow onOpenFile={openFileAction} />
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
