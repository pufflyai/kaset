import { Box, Flex } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useEffect } from "react";
import { CodeEditor } from "./components/ui/code-editor";
import { DragOverlay } from "./components/ui/drag-overlay";
import { FileExplorer } from "./components/ui/file-explorer";
import { ConversationHost } from "./components/ui/conversation-host";
import { TopBar } from "./components/ui/top-bar";
import { useDragAndDropUpload } from "./services/drag-n-drop";
import { setupPlayground } from "./services/playground/setup";
import { useWorkspaceStore } from "./state/WorkspaceProvider";

const rootDir = "playground";

export function App() {
  useEffect(() => {
    // Initialize OPFS workspace with a default README
    setupPlayground().catch((err) => {
      console.error("Failed to setup playground:", err);
    });
  }, []);

  const selectedPath = useWorkspaceStore((s) => s.local.filePath ?? null);

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useDragAndDropUpload({
    targetDir: rootDir,
  });

  return (
    <Flex
      direction="column"
      height="100vh"
      width="100vw"
      overflow="hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      position="relative"
    >
      <Allotment>
        {/* Conversation pane */}
        <Allotment.Pane minSize={260} preferredSize={420}>
          <Flex direction="column" height="100%" padding="3" gap="3">
            <TopBar />
            <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
              <ConversationHost />
            </Box>
          </Flex>
        </Allotment.Pane>

        {/* File explorer pane */}
        <Allotment.Pane minSize={220} preferredSize={280}>
          <Flex direction="column" height="100%" padding="3" gap="3">
            <Box flex="1" overflowY="auto" borderWidth="1px" borderRadius="md" padding="2">
              <FileExplorer
                rootDir={rootDir}
                selectedPath={selectedPath}
                onSelect={(path) => {
                  useWorkspaceStore.setState(
                    (state) => {
                      state.local.filePath = path ?? undefined;
                    },
                    false,
                    "file/select",
                  );
                }}
              />
            </Box>
          </Flex>
        </Allotment.Pane>

        {/* File preview pane */}
        <Allotment.Pane minSize={300}>
          <Flex direction="column" height="100%" padding="3" gap="3">
            <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
              <CodeEditor filePath={selectedPath ?? undefined} isEditable={Boolean(selectedPath)} showLineNumbers />
            </Box>
          </Flex>
        </Allotment.Pane>
      </Allotment>

      <DragOverlay visible={isDragging} />
    </Flex>
  );
}
