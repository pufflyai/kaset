import { Box, ChakraProvider, Flex, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";

function FileExplorerWindow() {
  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction="column">
      <Box flex="1" minHeight={0} overflow="hidden">
        <FileExplorer rootDir={ROOT_DIR} />
      </Box>
    </Flex>
  );
}

export function mount(container: Element | null) {
  if (!container) throw new Error("file-explorer mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(
    <ChakraProvider value={defaultSystem}>
      <FileExplorerWindow />
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
