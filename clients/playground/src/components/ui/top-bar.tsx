import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Conversation } from "@/state/types";
import { HStack, IconButton, Menu, Portal, Separator, Spacer, Text, useDisclosure } from "@chakra-ui/react";
import { Check as CheckIcon, EditIcon, HistoryIcon, Settings as SettingsIcon, Trash2 as TrashIcon } from "lucide-react";
import { SettingsModal } from "../../components/ui/settings-modal";
import { Tooltip } from "../../components/ui/tooltip";
import { MenuItem } from "./menu-item";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";

export function TopBar() {
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const deleteAll = useDisclosure();
  const conversations = useWorkspaceStore((s) => s.conversations);
  const selectedId = useWorkspaceStore((s) => s.local.selectedConversationId);

  const ids = Object.keys(conversations);

  const selectConversation = (id: string | undefined) => {
    if (!id) return;
    useWorkspaceStore.setState(
      (state) => {
        state.local.selectedConversationId = id;
      },
      false,
      "conversations/select",
    );
  };

  const createConversation = () => {
    // Prefer selecting an existing empty conversation over creating a new one
    const allIds = Object.keys(conversations);

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
    const number = Object.keys(conversations).length + 1;
    const name = `${nameBase} ${number}`;

    const convo: Conversation = { id, name, messages: [] };

    useWorkspaceStore.setState(
      (state) => {
        state.conversations[id] = convo;
        state.local.selectedConversationId = id;
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

    const convo: Conversation = { id, name, messages: [] };

    useWorkspaceStore.setState(
      (state) => {
        state.conversations = { [id]: convo };
        state.local.selectedConversationId = id;
      },
      false,
      "conversations/delete-all",
    );
  };

  return (
    <HStack justify="space-between" align="center">
      <Text fontSize="sm" color="fg.secondary">
        Kaset Playground
      </Text>
      <Spacer />
      <HStack>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton size="xs" variant="ghost">
              <HistoryIcon />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content bg="background.primary">
                <MenuItem
                  primaryLabel="Delete all conversations"
                  leftIcon={<TrashIcon size={16} />}
                  onClick={deleteAll.onOpen}
                />
                <Separator marginY="2" />
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
          </Portal>
        </Menu.Root>
        <Tooltip content="New conversation">
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
    </HStack>
  );
}
