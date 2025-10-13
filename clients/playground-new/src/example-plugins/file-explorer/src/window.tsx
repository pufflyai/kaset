import { Box, ChakraProvider, Flex, Heading, Text, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";

function FileExplorerWindow() {
  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction="column">
      <Box padding="6" borderBottomWidth="1px" borderColor="border.secondary" bg="background.secondary">
        <Heading as="h3" size="sm">
          Project Files
        </Heading>
        <Text fontSize="sm" color="foreground.tertiary" marginTop="1">
          Browse the playground directory. Click folders to drill into them. File interactions will be added in a future
          update.
        </Text>
      </Box>
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
