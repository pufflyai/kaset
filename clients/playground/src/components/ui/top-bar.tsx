import { PROJECTS_ROOT } from "@/constant";
import { createConversation, selectConversation, selectProject } from "@/services/conversations";
import { resetProject as resetProjectFiles } from "@/services/playground/reset";
import { resetConversationsForProject } from "@/services/playground/reset-conversations";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Menu,
  Portal,
  Separator,
  Spacer,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
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
import { useId, type ReactNode } from "react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { Tooltip } from "../../components/ui/tooltip";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";

interface TopBarProps {
  mobileCenterContent?: ReactNode;
}

export function TopBar(props: TopBarProps) {
  const { mobileCenterContent } = props;
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

  return (
    <Flex align="center" width="100%" gap="sm">
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
                  onClick={() => window.open("https://kaset.dev/", "_blank", "noopener,noreferrer")}
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
                      onClick={() => selectProject(p.id as "todo" | "slides")}
                    />
                  ))}
                </Menu.ItemGroup>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
      <Spacer />
      <Flex display={{ base: mobileCenterContent ? "flex" : "none", md: "none" }}>{mobileCenterContent}</Flex>
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
    </Flex>
  );
}
