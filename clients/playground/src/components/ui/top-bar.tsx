import { PROJECTS_ROOT } from "@/constant";
import { setupExample } from "@/services/playground/setup";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Conversation } from "@/state/types";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Menu,
  Portal,
  Separator,
  Spacer,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { getDirectoryHandle, ls } from "@pstdio/opfs-utils";
import {
  CassetteTapeIcon,
  Check as CheckIcon,
  ChevronDownIcon,
  EditIcon,
  ExternalLink as ExternalLinkIcon,
  HistoryIcon,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { useId } from "react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { Tooltip } from "../../components/ui/tooltip";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";

export function TopBar() {
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const deleteAll = useDisclosure();
  const resetProject = useDisclosure();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const selectedId = useWorkspaceStore((s) => s.selectedConversationId);
  const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");

  const triggerId = useId();

  const PROJECTS: Array<{ id: string; label: string }> = [
    { id: "todo", label: "Todos" },
    { id: "slides", label: "Slides" },
  ];

  const selectedProjectLabel = PROJECTS.find((p) => p.id === selectedProject)?.label ?? selectedProject;

  const ids = Object.keys(conversations).filter((id) => (conversations[id]?.projectId ?? "todo") === selectedProject);

  const selectConversation = (id: string | undefined) => {
    if (!id) return;
    useWorkspaceStore.setState(
      (state) => {
        state.selectedConversationId = id;
      },
      false,
      "conversations/select",
    );
  };

  const createConversation = () => {
    // Prefer selecting an existing empty conversation over creating a new one
    const allIds = Object.keys(conversations).filter(
      (id) => (conversations[id]?.projectId ?? "todo") === selectedProject,
    );

    const findIsEmpty = (id: string) => !conversations[id]?.messages || conversations[id]!.messages.length === 0;

    // Try an empty conversation different from the current selection first
    const otherEmpty = allIds.find((id) => id !== selectedId && findIsEmpty(id));
    if (otherEmpty) {
      selectConversation(otherEmpty);
      return;
    }

    // If the current one is empty, keep it selected (no new convo)
    if (selectedId && findIsEmpty(selectedId)) {
      selectConversation(selectedId);
      return;
    }

    const id = (
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2)
    ) as string;

    const nameBase = "Conversation";
    const number = allIds.length + 1;
    const name = `${nameBase} ${number}`;

    const convo: Conversation = { id, name, messages: [], projectId: selectedProject };

    useWorkspaceStore.setState(
      (state) => {
        state.conversations[id] = convo;
        state.selectedConversationId = id;
      },
      false,
      "conversations/create",
    );
  };

  const deleteAllConversations = () => {
    const id = (
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2)
    ) as string;

    const name = "Conversation 1";

    const convo: Conversation = { id, name, messages: [], projectId: selectedProject };

    useWorkspaceStore.setState(
      (state) => {
        // Remove only conversations for the current project
        const next: Record<string, Conversation> = {};
        for (const [key, value] of Object.entries(state.conversations)) {
          if ((value.projectId ?? "todo") !== selectedProject) next[key] = value;
        }
        next[id] = convo;
        state.conversations = next;
        state.selectedConversationId = id;
      },
      false,
      "conversations/delete-all",
    );
  };

  const handleResetProject = async () => {
    const rootDir = `${PROJECTS_ROOT}/${selectedProject}`;

    try {
      // Remove all entries under the project directory
      const dir = await getDirectoryHandle(rootDir);
      const children = await ls(dir, { maxDepth: 1 });

      for (const entry of children) {
        try {
          await (dir as any).removeEntry(entry.name, { recursive: true } as any);
        } catch (err) {
          console.warn(`Failed to remove ${entry.name} during reset:`, err);
        }
      }
    } catch (err) {
      // If directory doesn't exist yet, that's fine; we'll re-create below
      console.warn(`Project directory not found for reset (${rootDir}); will recreate.`, err);
    }

    try {
      // Re-apply bundled example files for the selected project
      await setupExample(selectedProject, { folderName: rootDir, overwrite: true });
    } catch (err) {
      console.error(`Failed to setup example for ${selectedProject}:`, err);
    }

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

  return (
    <HStack justify="space-between" align="center">
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
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
        <Menu.Root ids={{ trigger: triggerId }}>
          <Tooltip ids={{ trigger: triggerId }} content="Switch Demo Project">
            <Menu.Trigger asChild>
              <Button size="xs" variant="ghost" aria-label="Switch Demo Project">
                <Text fontSize="sm">{selectedProjectName}</Text>
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
                      onClick={() => {
                        useWorkspaceStore.setState(
                          (state) => {
                            state.selectedProjectId = p.id as "todo" | "slides";

                            // Ensure a selected conversation for this project
                            const projectIds = Object.keys(state.conversations).filter(
                              (id) => (state.conversations[id]?.projectId ?? "todo") === p.id,
                            );

                            const findIsEmpty = (id: string) =>
                              !state.conversations[id]?.messages || state.conversations[id]!.messages.length === 0;

                            let nextSelected = projectIds.find((id) => findIsEmpty(id)) || projectIds[0];

                            if (!nextSelected) {
                              const newId = (
                                typeof crypto !== "undefined" && (crypto as any).randomUUID
                                  ? (crypto as any).randomUUID()
                                  : Math.random().toString(36).slice(2)
                              ) as string;
                              const number = 1;
                              state.conversations[newId] = {
                                id: newId,
                                name: `Conversation ${number}`,
                                messages: [],
                                projectId: p.id,
                              };
                              nextSelected = newId;
                            }

                            state.selectedConversationId = nextSelected;
                          },
                          false,
                          "project/select",
                        );
                      }}
                    />
                  ))}
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
      <Spacer />
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
      <Tooltip content="Settings">
        <IconButton aria-label="Settings" size="xs" variant="ghost" onClick={onOpen}>
          <SettingsIcon size={16} />
        </IconButton>
      </Tooltip>
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
