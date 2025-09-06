import { Box, Flex, HStack, Tabs, Text } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { useEffect } from "react";
import { CodeEditor } from "./components/ui/code-editor";
import { ConversationHost } from "./components/ui/conversation-host";
import { DragOverlay } from "./components/ui/drag-overlay";
import { FileExplorer } from "./components/ui/file-explorer";
import { TopBar } from "./components/ui/top-bar";
import { setupSlides } from "./examples/slides/setup";
import { TodoList } from "./examples/todo/component";
import { setupPlayground as setupTodo } from "./examples/todo/setup";
import { useDragAndDropUpload } from "./services/drag-n-drop";
import { useWorkspaceStore } from "./state/WorkspaceProvider";

export function App() {
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");
  const rootDir = `playground/${selectedProject}`;

  useEffect(() => {
    // Initialize OPFS workspace for the selected project
    if (selectedProject === "todo") {
      setupTodo({ folderName: rootDir }).catch((err) => {
        console.error("Failed to setup todo playground:", err);
      });
    } else if (selectedProject === "slides") {
      setupSlides({ folderName: rootDir }).catch((err) => {
        console.error("Failed to setup slides playground:", err);
      });
    }
  }, [selectedProject, rootDir]);

  const selectedPath = useWorkspaceStore((s) => s.filePath ?? null);
  const selectedTab = useWorkspaceStore((s) => s.selectedTab ?? "preview");

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

        {/* Right side: Tabs for Preview and Code */}
        <Allotment.Pane minSize={360}>
          <Flex direction="column" height="100%" padding="3" gap="3">
            <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
              <Tabs.Root
                display="flex"
                flexDirection="column"
                height="100%"
                value={selectedTab}
                onValueChange={(e: any) => {
                  const next = (e?.value ?? e) as "preview" | "code";
                  if (next !== "preview" && next !== "code") return;
                  useWorkspaceStore.setState(
                    (state) => {
                      state.selectedTab = next;
                    },
                    false,
                    "ui/tabs/change",
                  );
                }}
              >
                <Tabs.List
                  background="transparent"
                  borderBottom="1px solid"
                  borderColor="border.secondary"
                  borderRadius={0}
                  paddingX="2"
                  paddingY="1.5"
                >
                  <Tabs.Trigger maxHeight="32px" value="preview">
                    <HStack gap="2" align="center">
                      <Text>Preview</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger maxHeight="32px" value="code">
                    <HStack gap="2" align="center">
                      <Text>Files</Text>
                    </HStack>
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Preview panel: render the example component */}
                <Tabs.Content value="preview" flex="1" display="flex" overflow="hidden" padding="0">
                  <Box flex="1" overflow="hidden">
                    {selectedProject === "todo" ? (
                      <TodoList rootDir={rootDir} />
                    ) : (
                      <Flex align="center" justify="center" height="100%">
                        <Text color="fg.secondary">Slides — coming soon</Text>
                      </Flex>
                    )}
                  </Box>
                </Tabs.Content>

                {/* Code panel: file explorer + file preview */}
                <Tabs.Content value="code" flex="1" display="flex" overflow="hidden" padding="0">
                  <Box flex="1" display="flex" overflow="hidden">
                    <Allotment>
                      <Allotment.Pane minSize={220} preferredSize={280}>
                        <Box height="100%" overflowY="auto" padding="2">
                          <FileExplorer
                            rootDir={rootDir}
                            selectedPath={selectedPath}
                            onSelect={(path) => {
                              useWorkspaceStore.setState(
                                (state) => {
                                  state.filePath = path ?? undefined;
                                  if (path) state.selectedTab = "code";
                                },
                                false,
                                "file/select",
                              );
                            }}
                          />
                        </Box>
                      </Allotment.Pane>

                      <Allotment.Pane minSize={300}>
                        <Box height="100%" overflow="hidden">
                          <CodeEditor
                            filePath={selectedPath ?? undefined}
                            isEditable={Boolean(selectedPath)}
                            showLineNumbers
                          />
                        </Box>
                      </Allotment.Pane>
                    </Allotment>
                  </Box>
                </Tabs.Content>
              </Tabs.Root>
            </Box>
          </Flex>
        </Allotment.Pane>
      </Allotment>

      <DragOverlay visible={isDragging} />
    </Flex>
  );
}
