import {
  Box,
  Button,
  Center,
  ChakraProvider,
  CloseButton,
  Drawer,
  Flex,
  Heading,
  Portal,
  Text,
  defaultSystem,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Menu as MenuIcon } from "lucide-react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CodeEditor } from "./components/code-editor";
import { FileExplorer } from "./components/file-explorer";

const ROOT_DIR = "playground";

function FileExplorerWindow() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const renderFileExplorer = () => (
    <Box flex="1" minHeight={0} padding="2" overflowY="auto">
      <FileExplorer
        rootDir={ROOT_DIR}
        selectedPath={selectedPath}
        onSelect={(path) => setSelectedPath(path)}
        defaultExpanded={[ROOT_DIR]}
      />
    </Box>
  );

  const renderMobileFileDrawer = () => (
    <Drawer.Root placement="start">
      <Drawer.Trigger asChild>
        <Button size="sm" variant="outline">
          <MenuIcon size={16} /> Files
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Text textStyle="heading/S/regular">Project Files</Text>
              <Drawer.CloseTrigger>
                <CloseButton />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              <Box maxHeight="75vh" overflowY="auto" paddingRight="2">
                {renderFileExplorer()}
              </Box>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );

  return (
    <Flex height="100%" bg="background.dark" color="foreground.inverse" direction={isMobile ? "column" : "row"}>
      {!isMobile && (
        <Flex width="240px" direction="column" bg="background.secondary">
          {renderFileExplorer()}
        </Flex>
      )}
      <Flex flex="1" direction="column" minWidth={0}>
        {isMobile && (
          <Flex
            align="center"
            justify="space-between"
            paddingX="3"
            paddingY="2"
            gap="3"
            borderBottomWidth="1px"
            borderColor="border.secondary"
            bg="background.secondary"
          >
            {renderMobileFileDrawer()}
          </Flex>
        )}
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
