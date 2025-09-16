import { Box, Button, Drawer, Flex, HStack, Portal, Tabs, Text } from "@chakra-ui/react";
import { Allotment } from "allotment";
import { GitCommitVerticalIcon } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CodeEditor } from "./components/ui/code-editor";
import { CommitHistory } from "./components/ui/commit-history";
import { ConversationHost } from "./components/ui/conversation-host";
import { DragOverlay } from "./components/ui/drag-overlay";
import { FileExplorer } from "./components/ui/file-explorer";
import { GithubCorner } from "./components/ui/github-corner";
import { TopBar } from "./components/ui/top-bar";
import { PROJECTS_ROOT } from "./constant";
import { TodoList } from "./examples/todo/component";
import { useDragAndDropUpload } from "./services/drag-n-drop";
import { setupExample } from "./services/playground/setup";
import { useWorkspaceStore } from "./state/WorkspaceProvider";
import { useIsMobile } from "./hooks/useIsMobile";
import { ensureDirExists, uploadFilesToDirectory } from "@pstdio/opfs-utils";

export function App() {
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");
  const rootDir = `${PROJECTS_ROOT}/${selectedProject}`;

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

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourcesDir = `${rootDir}/sources`;

  const { isDragging, handleDragEnter, handleDragOver, handleDragLeave, handleDrop } = useDragAndDropUpload({
    targetDir: sourcesDir,
  });

  useEffect(() => {
    if (!isMobile) {
      setMobileView("chat");
    }
  }, [isMobile]);

  const handleFilePickerChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    try {
      await ensureDirExists(sourcesDir, true);
      await uploadFilesToDirectory(sourcesDir, files);
    } catch (err) {
      console.error("Failed to upload files from picker:", err);
    } finally {
      event.target.value = "";
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const previewTabs = (
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
        flexWrap={isMobile ? "wrap" : undefined}
      >
        <Tabs.List
          width="full"
          display="flex"
          gap="md"
          overflowX={isMobile ? "auto" : "visible"}
          paddingBottom={isMobile ? "1" : "0"}
        >
          <Tabs.Trigger minHeight={isMobile ? "44px" : "32px"} value="preview">
            <HStack gap="sm" align="center">
              <Text>Preview</Text>
            </HStack>
          </Tabs.Trigger>
          <Tabs.Trigger minHeight={isMobile ? "44px" : "32px"} value="code">
            <HStack gap="sm" align="center">
              <Text>{isMobile ? "Code" : "Files"}</Text>
            </HStack>
          </Tabs.Trigger>
        </Tabs.List>

        <Drawer.Root>
          <Drawer.Trigger asChild>
            <Button aria-label="Version History" gap="2xs" variant="ghost" size={isMobile ? "md" : "sm"}>
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

      <Tabs.Content value="preview" flex="1" display="flex" overflow="hidden" padding="0">
        <Box flex="1" overflow="hidden">
          {selectedProject === "todo" ? (
            <TodoList />
          ) : (
            <Flex align="center" justify="center" height="100%">
              <Text color="fg.secondary">Slides — coming soon</Text>
            </Flex>
          )}
        </Box>
      </Tabs.Content>

      <Tabs.Content value="code" flex="1" display="flex" overflow="hidden" padding="0">
        <Box flex="1" display="flex" overflow="hidden" flexDirection="column" gap={isMobile ? "sm" : undefined}>
          {isMobile ? (
            <>
              <Button onClick={openFilePicker} size="md" variant="outline">
                Upload files
              </Button>
              <Box flex="1" overflow="hidden" borderRadius="md" borderWidth="1px">
                <CodeEditor
                  filePath={selectedPath ?? undefined}
                  isEditable={Boolean(selectedPath)}
                  showLineNumbers={!isMobile}
                />
              </Box>
            </>
          ) : (
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
          )}
        </Box>
      </Tabs.Content>
    </Tabs.Root>
  );

  return (
    <Flex
      direction="column"
      height="100vh"
      width="100vw"
      overflow="hidden"
      onDragEnter={isMobile ? undefined : handleDragEnter}
      onDragOver={isMobile ? undefined : handleDragOver}
      onDragLeave={isMobile ? undefined : handleDragLeave}
      onDrop={isMobile ? undefined : handleDrop}
      position="relative"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFilePickerChange}
      />

      {isMobile ? (
        <Tabs.Root
          value={mobileView}
          onValueChange={(value: string) => {
            if (value !== "chat" && value !== "preview") return;
            setMobileView(value as "chat" | "preview");
          }}
          display="flex"
          flexDirection="column"
          flex="1"
        >
          <Tabs.List
            display="flex"
            gap="sm"
            padding="sm"
            borderBottomWidth="1px"
            borderColor="border.secondary"
          >
            <Tabs.Trigger value="chat" flex="1" minHeight="44px">
              <Text>Chat</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="preview" flex="1" minHeight="44px">
              <Text>Preview</Text>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="chat" flex="1" display="flex" flexDirection="column" overflow="hidden">
            <Flex direction="column" flex="1" padding="3" gap="3">
              <TopBar />
              <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
                <ConversationHost />
              </Box>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="preview" flex="1" display="flex" flexDirection="column" overflow="hidden">
            <Flex direction="column" flex="1" padding="3" gap="3">
              <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
                {previewTabs}
              </Box>
            </Flex>
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        <Allotment>
          <Allotment.Pane minSize={260} preferredSize={420} maxSize={580}>
            <Flex direction="column" height="100%" padding="3" gap="3">
              <TopBar />
              <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
                <ConversationHost />
              </Box>
            </Flex>
          </Allotment.Pane>
          <Allotment.Pane minSize={360}>
            <Flex direction="column" height="100%" padding="3" gap="3">
              <Box flex="1" overflow="hidden" borderWidth="1px" borderRadius="md">
                {previewTabs}
              </Box>
            </Flex>
          </Allotment.Pane>
        </Allotment>
      )}

      {!isMobile && <GithubCorner href="https://github.com/pufflyai/kaset" />}
      {!isMobile && <DragOverlay visible={isDragging} />}
    </Flex>
  );
}
