import { Box, Button, Drawer, Flex, HStack, Portal, Tabs, Text, useBreakpointValue } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { GitCommitVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeEditor } from "./components/ui/code-editor";
import { CommitHistory } from "./components/ui/commit-history";
import { ConversationHost } from "./components/ui/conversation-host";
import { DragOverlay } from "./components/ui/drag-overlay";
import { FileExplorer } from "./components/ui/file-explorer";
import { GithubCorner } from "./components/ui/github-corner";
import { Toaster } from "./components/ui/toaster";
import { TopBar } from "./components/ui/top-bar";
import { PROJECTS_ROOT } from "./constant";
import { TodoList } from "./examples/todo/component";
import { TodoProvider } from "./examples/todo/state/TodoProvider";
import { useDragAndDropUpload } from "./services/drag-n-drop";
import { setupExample } from "./services/playground/setup";
import { useWorkspaceStore } from "./state/WorkspaceProvider";

export function App() {
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");
  const rootDir = `${PROJECTS_ROOT}/${selectedProject}`;
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  useEffect(() => {
    // Initialize OPFS workspace for the selected project
    if (selectedProject) {
      setupExample(selectedProject, { folderName: rootDir }).catch((err) => {
        console.error(`Failed to setup ${selectedProject} playground:`, err);
      });
    }
  }, [selectedProject, rootDir]);

  const selectedPath = useWorkspaceStore((s) => s.filePath ?? null);
  const selectedTab = useWorkspaceStore((s) => s.selectedTab ?? "preview");

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useDragAndDropUpload({
    targetDir: `${rootDir}/sources`,
  });
  const [mobilePane, setMobilePane] = useState<"conversation" | "preview">("conversation");

  useEffect(() => {
    if (!isMobile) setMobilePane("conversation");
  }, [isMobile]);

  const handleMobileToggle = () => {
    setMobilePane((current) => {
      const next = current === "conversation" ? "preview" : "conversation";
      if (next === "preview") {
        useWorkspaceStore.setState(
          (state) => {
            state.selectedTab = "preview";
          },
          false,
          "ui/mobile/toggle-preview",
        );
      }

      return next;
    });
  };

  const mobileToggleButton = !isMobile ? undefined : (
    <Button size="sm" variant="outline" onClick={handleMobileToggle} minWidth="140px">
      {mobilePane === "conversation" ? "Show Preview" : "Show Chat"}
    </Button>
  );

  const previewBody = (
    <Box flex="1" overflow="hidden">
      {selectedProject === "todo" ? (
        <TodoProvider>
          <TodoList />
        </TodoProvider>
      ) : (
        <Flex align="center" justify="center" height="100%">
          <Text color="fg.secondary">Slides — coming soon</Text>
        </Flex>
      )}
    </Box>
  );

  const conversationPane = (
    <Flex direction="column" height="100%" padding="3" gap="3" flex="1" width="100%">
      <TopBar mobileCenterContent={mobileToggleButton} />
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
        <ConversationHost />
      </Box>
    </Flex>
  );

  const workspacePane = (
    <Flex direction="column" height="100%" padding="3" gap="3">
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
        <Tabs.Root
          variant="enclosed"
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
          <Flex
            background="transparent"
            borderBottom="1px solid"
            borderColor="border.secondary"
            borderRadius={0}
            paddingX="sm"
            alignItems="center"
            paddingY="1.5"
            gap="md"
          >
            <Tabs.List>
              <Tabs.Trigger maxHeight="32px" value="preview">
                <HStack gap="sm" align="center">
                  <Text>Preview</Text>
                </HStack>
              </Tabs.Trigger>
              <Tabs.Trigger maxHeight="32px" value="code">
                <HStack gap="sm" align="center">
                  <Text>Files</Text>
                </HStack>
              </Tabs.Trigger>
            </Tabs.List>

            {/* Commit History Drawer */}
            <Drawer.Root>
              <Drawer.Trigger asChild>
                <Button aria-label="Version History" gap="2xs" variant="ghost">
                  <GitCommitVerticalIcon size={16} />
                  <Text textStyle="label/S/regular">Versions</Text>
                </Button>
              </Drawer.Trigger>
              <Portal>
                <Drawer.Backdrop />
                <Drawer.Positioner>
                  <Drawer.Content>
                    <Drawer.CloseTrigger />
                    <Drawer.Header>
                      <Drawer.Title>Versions</Drawer.Title>
                    </Drawer.Header>
                    <Drawer.Body>
                      <CommitHistory />
                    </Drawer.Body>
                    <Drawer.Footer />
                  </Drawer.Content>
                </Drawer.Positioner>
              </Portal>
            </Drawer.Root>
          </Flex>

          {/* Preview panel: render the example component */}
          <Tabs.Content value="preview" flex="1" display="flex" overflow="hidden" padding="0">
            {previewBody}
          </Tabs.Content>

          {/* Code panel: file explorer + file preview */}
          <Tabs.Content value="code" flex="1" display="flex" overflow="hidden" padding="0">
            <Box flex="1" display="flex" overflow="hidden">
              <Allotment>
                <Allotment.Pane minSize={220} preferredSize={280}>
                  <Box height="100%" overflowY="auto" padding="sm">
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
  );

  const mobilePreviewPane = (
    <Flex direction="column" height="100%" padding="3" gap="3">
      <TopBar mobileCenterContent={mobileToggleButton} />
      <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md" display="flex">
        {previewBody}
      </Box>
    </Flex>
  );

  return (
    <Flex
      direction="column"
      height="100vh"
      width="100vw"
      overflow="hidden"
      position="relative"
      {...(isMobile
        ? {}
        : {
            onDragEnter: handleDragEnter,
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop,
          })}
    >
      {isMobile ? (
        mobilePane === "conversation" ? (
          conversationPane
        ) : (
          mobilePreviewPane
        )
      ) : (
        <Allotment>
          {/* Conversation pane */}
          <Allotment.Pane minSize={260} preferredSize={420} maxSize={580}>
            {conversationPane}
          </Allotment.Pane>

          {/* Right side: Tabs for Preview and Code */}
          <Allotment.Pane minSize={360}>{workspacePane}</Allotment.Pane>
        </Allotment>
      )}

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}

      {!isMobile && <DragOverlay visible={isDragging} />}
      <Toaster />
    </Flex>
  );
}
