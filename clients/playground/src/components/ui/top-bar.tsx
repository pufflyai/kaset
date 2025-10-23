import { Tooltip, createConversation, selectConversation } from "@/kas-ui";
import { deleteAllConversations as deleteAllConversationsAction } from "@/state/actions/deleteAllConversations";
import { resetWorkspace } from "@/state/actions/resetWorkspace";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import {
  Box,
  Drawer,
  Flex,
  HStack,
  IconButton,
  Menu,
  Portal,
  Separator,
  Spacer,
  Span,
  useDisclosure,
} from "@chakra-ui/react";
import {
  CassetteTapeIcon,
  Check as CheckIcon,
  ChevronDownIcon,
  EditIcon,
  EraserIcon,
  ExternalLink as ExternalLinkIcon,
  HistoryIcon,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { resetPlayground } from "../../services/playground/reset";
import { CommitHistory } from "./commit-history";
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
  const versionHistory = useDisclosure();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const selectedId = useWorkspaceStore((s) => s.selectedConversationId);

  const handleDeleteAllConversations = () => {
    deleteAllConversationsAction();
  };

  const handleResetProject = async () => {
    try {
      await resetPlayground();
    } catch (error) {
      console.error("Failed to reset playground files", error);
    }

    resetWorkspace();
  };

  const handleVersionHistoryChange = (event: { open: boolean }) => {
    if (event.open) {
      versionHistory.onOpen();
      return;
    }

    versionHistory.onClose();
  };

  return (
    <Flex align="center" width="100%" gap="sm">
      <HStack gap="2xs">
        <Menu.Root>
          <Menu.Trigger asChild>
            <Box>
              <Tooltip content="Main Menu">
                <Span
                  cursor="pointer"
                  aria-label="Kaset menu"
                  display="flex"
                  alignItems="center"
                  gap="2xs"
                  fontWeight="medium"
                >
                  <CassetteTapeIcon />
                  <ChevronDownIcon size={12} />
                </Span>
              </Tooltip>
            </Box>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content bg="background.primary">
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>Kaset Playground</Menu.ItemGroupLabel>
                <MenuItem
                  primaryLabel="Undo Changes"
                  leftIcon={<EraserIcon size={16} />}
                  onClick={versionHistory.onOpen}
                />
                <MenuItem primaryLabel="Edit Settings" leftIcon={<SettingsIcon size={16} />} onClick={onOpen} />
              </Menu.ItemGroup>
              <Separator marginY="2xs" />
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>Learn More</Menu.ItemGroupLabel>
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
              <Separator marginY="2xs" />
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>Danger Zone</Menu.ItemGroupLabel>
                <MenuItem
                  primaryLabel="Delete all conversations"
                  leftIcon={<TrashIcon size={16} />}
                  onClick={deleteAll.onOpen}
                />
                <MenuItem
                  primaryLabel={`Reset playground`}
                  leftIcon={<RotateCcw size={16} />}
                  onClick={resetProject.onOpen}
                />
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
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
              {Object.values(conversations).length === 0 && <MenuItem primaryLabel="No conversations" isDisabled />}
              {Object.values(conversations).map((conversation) => (
                <MenuItem
                  key={conversation.id}
                  id={conversation.id}
                  primaryLabel={conversation.name ?? conversation.id}
                  isSelected={selectedId === conversation.id}
                  rightIcon={selectedId === conversation.id ? <CheckIcon size={16} /> : undefined}
                  onClick={() => selectConversation(conversation.id)}
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
      <SettingsModal isOpen={isOpen} onClose={onClose} />
      <DeleteConfirmationModal
        open={deleteAll.open}
        onClose={deleteAll.onClose}
        onDelete={handleDeleteAllConversations}
        headline="Delete all conversations"
        buttonText="Delete all"
      />
      <DeleteConfirmationModal
        open={resetProject.open}
        onClose={resetProject.onClose}
        onDelete={handleResetProject}
        headline={`Reset Playground`}
        notificationText={`Delete all files and restore default files? This actions cannot be undone.`}
        buttonText="Reset"
        closeOnInteractOutside={false}
      />
      <Drawer.Root open={versionHistory.open} onOpenChange={handleVersionHistoryChange}>
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
  );
}
