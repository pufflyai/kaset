import { createConversation } from "@/state/actions/createConversation";
import { deleteAllConversations as deleteAllConversationsAction } from "@/state/actions/deleteAllConversations";
import { selectConversation } from "@/state/actions/selectConversation";
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
  useDisclosure,
} from "@chakra-ui/react";
import {
  CassetteTapeIcon,
  Check as CheckIcon,
  EditIcon,
  ExternalLink as ExternalLinkIcon,
  GitCommitVerticalIcon,
  HistoryIcon,
  Settings as SettingsIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { Tooltip } from "../../components/ui/tooltip";
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
  const versionHistory = useDisclosure();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const selectedId = useWorkspaceStore((s) => s.selectedConversationId);

  const handleDeleteAllConversations = () => {
    deleteAllConversationsAction();
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
                primaryLabel="View version history"
                leftIcon={<GitCommitVerticalIcon size={16} />}
                onClick={versionHistory.onOpen}
              />
              <Separator marginY="sm" />
              <MenuItem
                primaryLabel="Delete all conversations"
                leftIcon={<TrashIcon size={16} />}
                onClick={deleteAll.onOpen}
              />
              <Separator marginY="sm" />
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
      <Tooltip content="Settings">
        <IconButton aria-label="Settings" size="xs" variant="ghost" onClick={onOpen}>
          <SettingsIcon size={16} />
        </IconButton>
      </Tooltip>
      <SettingsModal isOpen={isOpen} onClose={onClose} />
      <DeleteConfirmationModal
        open={deleteAll.open}
        onClose={deleteAll.onClose}
        onDelete={handleDeleteAllConversations}
        headline="Delete all conversations"
        buttonText="Delete all"
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
