import { PROJECTS_ROOT } from "@/constant";
import { resetProject as resetProjectFiles } from "@/services/playground/reset";
import { resetConversationsForProject } from "@/services/playground/reset-conversations";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { createConversation, selectConversation, selectProject } from "@/services/conversations";
import {
  Box,
  Button,
  Drawer,
  HStack,
  IconButton,
  Menu,
  Portal,
  Separator,
  Spacer,
  Stack,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import {
  CassetteTapeIcon,
  Check as CheckIcon,
  ChevronDownIcon,
  EditIcon,
  ExternalLink as ExternalLinkIcon,
  HistoryIcon,
  Menu as MenuIcon,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { useId } from "react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { Tooltip } from "../../components/ui/tooltip";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";
import { useIsMobile } from "@/hooks/useIsMobile";

export function TopBar() {
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const deleteAll = useDisclosure();
  const resetProject = useDisclosure();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const selectedId = useWorkspaceStore((s) => s.selectedConversationId);
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");

  const triggerId = useId();

  const isMobile = useIsMobile();
  const mobileNav = useDisclosure();

  const PROJECTS: Array<{ id: string; label: string }> = [
    { id: "todo", label: "Todos" },
    { id: "slides", label: "Slides" },
  ];

  const selectedProjectLabel = PROJECTS.find((p) => p.id === selectedProject)?.label ?? selectedProject;

  const ids = Object.keys(conversations).filter((id) => (conversations[id]?.projectId ?? "todo") === selectedProject);

  // Conversation logic is now handled via services/conversations

  const deleteAllConversations = () => {
    resetConversationsForProject(selectedProject);
  };

  const handleResetProject = async () => {
    const rootDir = `${PROJECTS_ROOT}/${selectedProject}`;

    await resetProjectFiles(selectedProject, { folderName: rootDir });

    // If a file from this project was selected, clear the selection
    useWorkspaceStore.setState(
      (state) => {
        if (state.filePath && state.filePath.startsWith(rootDir + "/")) {
          state.filePath = undefined;
        }
      },
      false,
      "project/reset",
    );
  };

  const selectedProjectName = PROJECTS.find((p) => p.id === selectedProject)?.label ?? selectedProject;

  const projectSwitcher = (
    <Menu.Root ids={{ trigger: triggerId }}>
      <Tooltip ids={{ trigger: triggerId }} content="Switch Demo Project" disabled={isMobile}>
        <Menu.Trigger asChild>
          <Button
            size={isMobile ? "md" : "xs"}
            variant="ghost"
            aria-label="Switch Demo Project"
            minHeight={isMobile ? "44px" : undefined}
          >
            <Text fontSize={isMobile ? "md" : "sm"}>{selectedProjectName}</Text>
            <ChevronDownIcon />
          </Button>
        </Menu.Trigger>
      </Tooltip>
      <Portal>
        <Menu.Positioner>
          <Menu.Content bg="background.primary">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>Projects</Menu.ItemGroupLabel>
              {PROJECTS.map((p) => (
                <MenuItem
                  key={p.id}
                  id={p.id}
                  primaryLabel={p.label}
                  isSelected={selectedProject === p.id}
                  rightIcon={selectedProject === p.id ? <CheckIcon size={16} /> : undefined}
                  onClick={() => selectProject(p.id as "todo" | "slides")}
                />
              ))}
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );

  return (
    <HStack justify="space-between" align="center" width="full">
      {isMobile ? (
        <HStack gap="sm" align="center">
          <Drawer.Root
            open={mobileNav.open}
            onOpenChange={(detail) => {
              if (detail.open) mobileNav.onOpen();
              else mobileNav.onClose();
            }}
          >
            <Drawer.Trigger asChild>
              <IconButton
                aria-label="Open navigation"
                size="md"
                variant="ghost"
                minHeight="44px"
              >
                <MenuIcon size={20} />
              </IconButton>
            </Drawer.Trigger>
            <Portal>
              <Drawer.Backdrop />
              <Drawer.Positioner>
                <Drawer.Content>
                  <Drawer.CloseTrigger />
                  <Drawer.Header>
                    <Drawer.Title>Kaset Playground</Drawer.Title>
                  </Drawer.Header>
                  <Drawer.Body>
                    <Stack gap="lg">
                      <Stack gap="xs">
                        <Text fontSize="md" fontWeight="semibold">
                          Quick links
                        </Text>
                        <Button
                          size="md"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            window.open("https://pufflyai.github.io/kaset/", "_blank", "noopener,noreferrer");
                            mobileNav.onClose();
                          }}
                        >
                          Documentation
                        </Button>
                        <Button
                          size="md"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            window.open("https://github.com/pufflyai/kaset/discussions", "_blank", "noopener,noreferrer");
                            mobileNav.onClose();
                          }}
                        >
                          Contact & Support
                        </Button>
                      </Stack>

                      <Stack gap="xs">
                        <Text fontSize="md" fontWeight="semibold">
                          Projects
                        </Text>
                        <VStack align="stretch" gap="xs">
                          {PROJECTS.map((p) => (
                            <Button
                              key={p.id}
                              size="md"
                              variant={selectedProject === p.id ? "solid" : "ghost"}
                              justifyContent="space-between"
                              onClick={() => {
                                selectProject(p.id as "todo" | "slides");
                                mobileNav.onClose();
                              }}
                            >
                              <Text>{p.label}</Text>
                              {selectedProject === p.id && <CheckIcon size={16} />}
                            </Button>
                          ))}
                        </VStack>
                      </Stack>

                      <Stack gap="xs">
                        <Text fontSize="md" fontWeight="semibold">
                          Conversations
                        </Text>
                        <Box borderWidth="1px" borderRadius="md" maxHeight="240px" overflowY="auto" padding="xs">
                          <VStack align="stretch" gap="xs">
                            {ids.length === 0 && <Text color="fg.secondary">No conversations yet.</Text>}
                            {ids.map((id) => (
                              <Button
                                key={id}
                                size="md"
                                variant={selectedId === id ? "solid" : "ghost"}
                                justifyContent="space-between"
                                onClick={() => {
                                  selectConversation(id);
                                  mobileNav.onClose();
                                }}
                              >
                                <Text>{conversations[id]?.name ?? id}</Text>
                                {selectedId === id && <CheckIcon size={16} />}
                              </Button>
                            ))}
                          </VStack>
                        </Box>
                      </Stack>

                      <Stack gap="xs">
                        <Text fontSize="md" fontWeight="semibold">
                          Actions
                        </Text>
                        <Button
                          size="md"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            mobileNav.onClose();
                            resetProject.onOpen();
                          }}
                        >
                          <HStack gap="sm">
                            <RotateCcw size={18} />
                            <Text>Reset project</Text>
                          </HStack>
                        </Button>
                        <Button
                          size="md"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            mobileNav.onClose();
                            deleteAll.onOpen();
                          }}
                        >
                          <HStack gap="sm">
                            <TrashIcon size={18} />
                            <Text>Delete all conversations</Text>
                          </HStack>
                        </Button>
                        <Button
                          size="md"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => {
                            mobileNav.onClose();
                            onOpen();
                          }}
                        >
                          <HStack gap="sm">
                            <SettingsIcon size={18} />
                            <Text>Settings</Text>
                          </HStack>
                        </Button>
                      </Stack>
                    </Stack>
                  </Drawer.Body>
                </Drawer.Content>
              </Drawer.Positioner>
            </Portal>
          </Drawer.Root>
          {projectSwitcher}
        </HStack>
      ) : (
        <HStack gap="2xs">
          <Menu.Root>
            <Menu.Trigger asChild>
              <Box cursor="pointer" aria-label="Kaset menu">
                <CassetteTapeIcon />
              </Box>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content bg="background.primary">
                <Menu.ItemGroup>
                  <Menu.ItemGroupLabel>Kaset Playground</Menu.ItemGroupLabel>
                  <MenuItem
                    primaryLabel="Documentation"
                    leftIcon={<ExternalLinkIcon size={16} />}
                    onClick={() => window.open("https://pufflyai.github.io/kaset/", "_blank", "noopener,noreferrer")}
                  />
                  <MenuItem
                    primaryLabel="Contact & Support"
                    leftIcon={<ExternalLinkIcon size={16} />}
                    onClick={() =>
                      window.open("https://github.com/pufflyai/kaset/discussions", "_blank", "noopener,noreferrer")
                    }
                  />
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
          {projectSwitcher}
        </HStack>
      )}
      <Spacer />
      {isMobile ? (
        <HStack gap="sm">
          <IconButton
            aria-label="New"
            size="md"
            variant="ghost"
            minHeight="44px"
            onClick={createConversation}
          >
            <EditIcon size={20} />
          </IconButton>
        </HStack>
      ) : (
        <HStack>
          <Menu.Root>
            <Menu.Trigger asChild>
              <Box>
                <Tooltip content="History">
                  <IconButton size="xs" variant="ghost">
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content bg="background.primary">
                <MenuItem
                  primaryLabel={`Reset ${selectedProjectLabel} project`}
                  leftIcon={<RotateCcw size={16} />}
                  onClick={resetProject.onOpen}
                />
                <MenuItem
                  primaryLabel="Delete all conversations"
                  leftIcon={<TrashIcon size={16} />}
                  onClick={deleteAll.onOpen}
                />
                <Separator marginY="sm" />
                {ids.length === 0 && <MenuItem primaryLabel="No conversations" isDisabled />}
                {ids.map((id) => (
                  <MenuItem
                    key={id}
                    id={id}
                    primaryLabel={conversations[id]?.name ?? id}
                    isSelected={selectedId === id}
                    rightIcon={selectedId === id ? <CheckIcon size={16} /> : undefined}
                    onClick={() => selectConversation(id)}
                  />
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
          <Tooltip content="New Conversation">
            <IconButton aria-label="New" size="xs" variant="ghost" onClick={createConversation}>
              <EditIcon size={16} />
            </IconButton>
          </Tooltip>
        </HStack>
      )}
      {!isMobile && (
        <Tooltip content="Settings">
          <IconButton aria-label="Settings" size="xs" variant="ghost" onClick={onOpen}>
            <SettingsIcon size={16} />
          </IconButton>
        </Tooltip>
      )}
      <SettingsModal isOpen={isOpen} onClose={onClose} />
      <DeleteConfirmationModal
        open={deleteAll.open}
        onClose={deleteAll.onClose}
        onDelete={() => deleteAllConversations()}
        headline="Delete all conversations"
        buttonText="Delete all"
      />
      <DeleteConfirmationModal
        open={resetProject.open}
        onClose={resetProject.onClose}
        onDelete={handleResetProject}
        headline={`Reset ${selectedProjectLabel} project`}
        notificationText={`Remove all files under "${PROJECTS_ROOT}/${selectedProject}" and restore defaults for ${selectedProjectLabel}?`}
        buttonText="Reset project"
      />
    </HStack>
  );
}
