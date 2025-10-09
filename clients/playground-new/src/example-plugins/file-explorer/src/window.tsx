import { Box, Center, ChakraProvider, defaultSystem, Flex, Heading, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeEditor } from "./components/code-editor";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";

function FileExplorerWindow() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse">
      <Flex
        width="240px"
        direction="column"
        borderRightWidth="1px"
        borderColor="border.secondary"
        bg="background.secondary"
      >
        <Box flex="1" minHeight={0} padding="2" overflowY="auto">
          <FileExplorer
            rootDir={ROOT_DIR}
            selectedPath={selectedPath}
            onSelect={(path) => setSelectedPath(path)}
            defaultExpanded={[ROOT_DIR]}
          />
        </Box>
      </Flex>

      <Flex flex="1" direction="column" minWidth={0}>
        {selectedPath ? (
          <Box flex="1" minHeight={0}>
            <CodeEditor filePath={selectedPath} />
          </Box>
        ) : (
          <Center flex="1" padding="8">
            <Box maxW="360px" textAlign="center">
              <Heading as="h3" size="sm" marginBottom="2">
                Select a file to preview
              </Heading>
              <Text fontSize="sm" color="foreground.tertiary">
                Browse the mock playground directory on the left. Pick any file to view its contents in the viewer
                panel.
              </Text>
            </Box>
          </Center>
        )}
      </Flex>
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
