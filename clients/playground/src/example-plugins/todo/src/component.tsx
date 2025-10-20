import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import {
  Box,
  Button,
  Checkbox,
  CloseButton,
  Drawer,
  EmptyState,
  HStack,
  IconButton,
  Input,
  Portal,
  Text,
  VStack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Menu as MenuIcon, PencilIcon, Trash2 } from "lucide-react";
import { Fragment } from "react";
import { useTodoStore } from "./state/TodoProvider";

function displayListName(name: string) {
  const base = name.replace(/\.md$/i, "");

  const words = base.split(/[-_\s]+/).filter(Boolean);
  if (words.length === 0) return base;

  return words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

export function TodoList() {
  const lists = useTodoStore((state) => state.lists);
  const selectedList = useTodoStore((state) => state.selectedList);
  const selectList = useTodoStore((state) => state.selectList);

  const newListName = useTodoStore((state) => state.newListName);
  const setNewListName = useTodoStore((state) => state.setNewListName);
  const addList = useTodoStore((state) => state.addList);
  const requestDeleteList = useTodoStore((state) => state.requestDeleteList);

  const items = useTodoStore((state) => state.items);
  const setChecked = useTodoStore((state) => state.setChecked);
  const removeItem = useTodoStore((state) => state.removeItem);

  const newItemText = useTodoStore((state) => state.newItemText);
  const setNewItemText = useTodoStore((state) => state.setNewItemText);
  const addItem = useTodoStore((state) => state.addItem);

  const editingLine = useTodoStore((state) => state.editingLine);
  const editingText = useTodoStore((state) => state.editingText);
  const setEditingText = useTodoStore((state) => state.setEditingText);
  const startEditing = useTodoStore((state) => state.startEditing);
  const cancelEditing = useTodoStore((state) => state.cancelEditing);
  const saveEditing = useTodoStore((state) => state.saveEditing);

  const deleteModalOpen = useTodoStore((state) => state.deleteModalOpen);
  const cancelDeleteList = useTodoStore((state) => state.cancelDeleteList);
  const confirmDeleteList = useTodoStore((state) => state.confirmDeleteList);
  const pendingDeleteList = useTodoStore((state) => state.pendingDeleteList);

  const error = useTodoStore((state) => state.error);
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;

  const listNavigationContent = (
    <>
      <HStack gap="1" marginBottom="3" flexWrap="wrap">
        <Input
          value={newListName}
          onChange={(event) => setNewListName(event.currentTarget.value)}
          placeholder="New list name"
          size="sm"
          flex="1"
          minW="0"
        />
        <Button variant="outline" size="sm" onClick={() => addList()} flexShrink={0}>
          Add List
        </Button>
      </HStack>

      {lists.length === 0 && (
        <EmptyState.Root size="sm">
          <EmptyState.Content>
            <EmptyState.Title>No todo lists yet</EmptyState.Title>
            <EmptyState.Description>Create your first list above.</EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      )}

      {lists.length > 0 && (
        <VStack align="stretch" gap="xs">
          {lists.map((name) => {
            const isSelected = name === selectedList;
            const listItem = (
              <HStack
                justify="space-between"
                align="center"
                paddingX="2"
                paddingY="1.5"
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: "bg.subtle" }}
                onClick={() => selectList(name)}
                textDecoration={isSelected ? "underline" : "none"}
              >
                <Text fontSize="sm" title={name} flex="1">
                  {displayListName(name)}
                </Text>
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestDeleteList(name);
                  }}
                  colorPalette="red"
                  aria-label={`Delete ${displayListName(name)}`}
                >
                  <Trash2 size={12} />
                </IconButton>
              </HStack>
            );

            if (isMobile) {
              return listItem;
            }

            return <Fragment key={name}>{listItem}</Fragment>;
          })}
        </VStack>
      )}
    </>
  );

  const renderMobileListDrawer = () => (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <Button size="sm" variant="outline">
          <MenuIcon size={16} /> Lists
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Text textStyle="heading/S/regular">Todo Lists</Text>
              <Drawer.CloseTrigger>
                <CloseButton />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              <Box maxHeight="75vh" overflowY="auto" paddingRight="1">
                {listNavigationContent}
              </Box>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );

  return (
    <>
      <Box height="100%" display="flex" flexDirection="column" borderTopWidth="1px">
        <Box flex="1" overflow="hidden" display="flex" flexDirection={isMobile ? "column" : "row"}>
          {!isMobile && (
            <Box width="280px" borderRightWidth="1px" overflowY="auto" padding="2">
              {listNavigationContent}
            </Box>
          )}

          <Box flex="1" overflowY="auto" padding="3">
            <Box maxW="720px" mx="auto">
              {selectedList && (
                <HStack justify="space-between" align="center" marginBottom="3">
                  <HStack>
                    <Text fontSize="lg" color="fg.secondary">
                      {displayListName(selectedList)}
                    </Text>
                  </HStack>
                  {isMobile && renderMobileListDrawer()}
                </HStack>
              )}

              {!selectedList && isMobile && (
                <HStack justify="flex-end" marginBottom="3">
                  {renderMobileListDrawer()}
                </HStack>
              )}

              {!error && selectedList && (
                <VStack align="stretch" gap="3">
                  <HStack>
                    <Input
                      value={newItemText}
                      onChange={(event) => setNewItemText(event.currentTarget.value)}
                      placeholder="Add a new todo"
                      size="sm"
                    />
                    <Button size="sm" onClick={() => addItem()} disabled={!newItemText.trim()}>
                      Add
                    </Button>
                  </HStack>

                  {items.length === 0 && (
                    <Text fontSize="sm" color="fg.secondary">
                      Todo list is empty.
                    </Text>
                  )}

                  {items.length > 0 && (
                    <VStack align="stretch" gap="sm">
                      {items.map((todo) => (
                        <HStack key={todo.line} justify="space-between" align="center">
                          <Checkbox.Root
                            width="100%"
                            cursor="pointer"
                            checked={todo.done}
                            onCheckedChange={(event) => setChecked(todo.line, !!event.checked)}
                          >
                            <HStack>
                              <Checkbox.HiddenInput />
                              <Checkbox.Control cursor="pointer" />
                              <Checkbox.Label cursor="pointer">
                                {editingLine === todo.line ? (
                                  <Input
                                    size="xs"
                                    autoFocus
                                    value={editingText}
                                    onChange={(event) => setEditingText(event.currentTarget.value)}
                                    onBlur={() => saveEditing()}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") saveEditing();
                                      if (event.key === "Escape") cancelEditing();
                                    }}
                                  />
                                ) : (
                                  <Text
                                    fontSize="sm"
                                    textDecoration={todo.done ? "line-through" : "none"}
                                    color={todo.done ? "fg.muted" : "fg.primary"}
                                    onDoubleClick={() => startEditing(todo.line, todo.text)}
                                  >
                                    {todo.text || "(empty)"}
                                  </Text>
                                )}
                              </Checkbox.Label>
                            </HStack>
                          </Checkbox.Root>
                          <HStack>
                            {editingLine === todo.line ? (
                              <Button size="xs" onClick={() => saveEditing()}>
                                Save
                              </Button>
                            ) : (
                              <IconButton size="xs" variant="ghost" onClick={() => startEditing(todo.line, todo.text)}>
                                <PencilIcon size={14} />
                              </IconButton>
                            )}
                            <IconButton
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              onClick={() => removeItem(todo.line)}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </VStack>
              )}

              {!selectedList && (
                <Text fontSize="sm" color="fg.secondary">
                  Select or create a list.
                </Text>
              )}

              {error && (
                <Text fontSize="sm" color="red.400">
                  {String(error)}
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={cancelDeleteList}
        onDelete={() => confirmDeleteList()}
        headline="Delete List"
        notificationText={`Are you sure you want to delete "${displayListName(
          pendingDeleteList ?? "",
        )}"? This action cannot be undone.`}
        buttonText="Delete"
      />
    </>
  );
}

export default TodoList;
