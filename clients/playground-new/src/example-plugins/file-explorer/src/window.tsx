import { Box, Center, Flex, Heading, Text, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";
import { CodeEditor } from "./components/code-editor";

const ROOT_DIR = "playground";

const normalizePath = (path: string | null) => {
  if (!path) return null;
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
};

export function FileExplorerWindow() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const headerSubtitle = useMemo(() => {
    if (!selectedPath) return "Pick a file to open in the editor";
    const normalized = normalizePath(selectedPath) as string;
    const prefix = `${ROOT_DIR}/`;
    return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  }, [selectedPath]);

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse">
      <Flex
        width="240px"
        direction="column"
        borderRightWidth="1px"
        borderColor="border.secondary"
        bg="background.secondary"
      >
        <Box padding="4" borderBottomWidth="1px" borderColor="border.secondary">
          <Heading as="h2" size="sm" marginBottom="1" color="foreground.inverse">
            Playground Files
          </Heading>
          <Text fontSize="xs" color="foreground.tertiary" lineClamp={2}>
            {headerSubtitle}
          </Text>
        </Box>

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
    <StrictMode>
      <ChakraProvider value={defaultSystem}>
        <FileExplorerWindow />
      </ChakraProvider>
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}

export default FileExplorerWindow;
