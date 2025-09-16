import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { PROJECTS_ROOT } from "@/constant";
import { Box, Button, Checkbox, HStack, IconButton, Input, Text, VStack } from "@chakra-ui/react";
import { deleteFile, ensureDirExists, ls, readFile, watchDirectory, writeFile } from "@pstdio/opfs-utils";
import { PencilIcon, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

export interface TodoListProps {
  /**
   * Folder name under `rootDir` that contains individual todo lists as `.md` files.
   * Default: "todos". Previously this component used a single file; it now manages multiple lists.
   */
  fileName?: string;
}

type TodoItem = {
  line: number;
  text: string;
  done: boolean;
};

function parseMarkdownTodos(md: string): TodoItem[] {
  const lines = md.split("\n");

  const items: TodoItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*[-*]\s*\[( |x|X)\]\s*(.*)$/.exec(line);
    if (!m) continue;

    const done = m[1].toLowerCase() === "x";
    const text = m[2] ?? "";

    items.push({ line: i, text, done });
  }

  return items;
}

function toggleCheckboxAtLine(md: string, lineIndex: number, checked: boolean): string {
  const lines = md.split("\n");
  const line = lines[lineIndex] ?? "";

  const toggled = line.replace(/(\s*[-*]\s*\[)( |x|X)(\]\s*)/, (_m, p1, _, p3) => {
    const next = checked ? "x" : " ";
    return `${p1}${next}${p3}`;
  });

  lines[lineIndex] = toggled;
  return lines.join("\n");
}

function replaceTodoTextAtLine(md: string, lineIndex: number, nextText: string): string {
  const lines = md.split("\n");
  const line = lines[lineIndex] ?? "";

  // Replace the trailing text of a markdown todo, preserving prefix like "- [x] "
  const replaced = line.replace(/^(\s*[-*]\s*\[(?: |x|X)\]\s*)(.*)$/u, (_m, p1) => `${p1}${nextText}`);

  lines[lineIndex] = replaced;
  return lines.join("\n");
}

function displayListName(name: string): string {
  const base = name.replace(/\.md$/i, "");

  const words = base.split(/[-_\s]+/).filter(Boolean);
  if (words.length === 0) return base;

  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function TodoList() {
  const listsDirPath = `${PROJECTS_ROOT}/todo/todos`;

  const [error, setError] = useState<string | null>(null);

  const [lists, setLists] = useState<string[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);

  const [content, setContent] = useState<string | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);

  const [newListName, setNewListName] = useState<string>("");
  const [newItemText, setNewItemText] = useState<string>("");

  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteList, setPendingDeleteList] = useState<string | null>(null);

  const dirAbortRef = useRef<AbortController | null>(null);

  const isMobile = useIsMobile();
  const [contentVisible, setContentVisible] = useState(!isMobile);

  useEffect(() => {
    setContentVisible(!isMobile);
  }, [isMobile]);

  const parse = useCallback((md: string) => parseMarkdownTodos(md), []);

  const refreshLists = useCallback(async () => {
    try {
      setError(null);

      await ensureDirExists(listsDirPath, true);
      const entries = await ls(listsDirPath, { maxDepth: 1, kinds: ["file"], include: ["*.md"] });

      const names = entries.map((e) => e.name).sort((a, b) => a.localeCompare(b));
      setLists(names);

      if (!names.includes(selectedList ?? "")) {
        const nextSelected = names[0] ?? null;
        setSelectedList(nextSelected);
        if (nextSelected) void readAndParse(nextSelected);
        else {
          setContent(null);
          setItems([]);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [listsDirPath, selectedList]);

  const readAndParse = useCallback(
    async (fileName: string) => {
      const path = `${listsDirPath}/${fileName}`;
      try {
        const md = await readFile(path);
        setContent(md);
        setItems(parse(md));
      } catch (e: any) {
        setError(e?.name === "NotFoundError" ? `File not found: ${path}` : (e?.message ?? String(e)));
      }
    },
    [listsDirPath, parse],
  );

  const selectList = useCallback(
    async (name: string) => {
      setSelectedList(name);
      await readAndParse(name);
    },
    [readAndParse],
  );

  const addList = useCallback(async () => {
    const raw = (newListName || "New List").trim();
    if (!raw) return;

    const name = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
    const path = `${listsDirPath}/${name}`;

    try {
      await writeFile(path, "- [ ] New item\n");
      setNewListName("");
      await refreshLists();
      await selectList(name);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [listsDirPath, newListName, refreshLists, selectList]);

  const removeList = useCallback(
    async (name: string) => {
      const path = `${listsDirPath}/${name}`;
      try {
        await deleteFile(path);
        if (selectedList === name) {
          setSelectedList(null);
          setContent(null);
          setItems([]);
        }
        await refreshLists();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      }
    },
    [listsDirPath, selectedList, refreshLists],
  );

  const requestDeleteList = useCallback((name: string) => {
    setPendingDeleteList(name);
    setDeleteModalOpen(true);
  }, []);

  const cancelDeleteList = useCallback(() => {
    setDeleteModalOpen(false);
    setPendingDeleteList(null);
  }, []);

  const confirmDeleteList = useCallback(async () => {
    if (!pendingDeleteList) return;
    await removeList(pendingDeleteList);
    setPendingDeleteList(null);
    setDeleteModalOpen(false);
  }, [pendingDeleteList, removeList]);

  const setChecked = useCallback(
    async (line: number, checked: boolean) => {
      if (!selectedList || content == null) return;
      const next = toggleCheckboxAtLine(content, line, checked);

      setContent(next);
      setItems(parse(next));

      try {
        await writeFile(`${listsDirPath}/${selectedList}`, next);
      } catch (e) {
        setContent(content);
        setItems(parse(content));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [content, listsDirPath, selectedList, parse],
  );

  const addItem = useCallback(async () => {
    if (!selectedList) return;
    const text = newItemText.trim();
    if (!text) return;

    const prev = content ?? "";
    const prefix = prev.endsWith("\n") || prev.length === 0 ? "" : "\n";
    const next = prev + prefix + `- [ ] ${text}\n`;

    setContent(next);
    setItems(parse(next));
    setNewItemText("");

    try {
      await writeFile(`${listsDirPath}/${selectedList}`, next);
    } catch (e) {
      setContent(prev);
      setItems(parse(prev));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [content, listsDirPath, newItemText, selectedList, parse]);

  const removeItem = useCallback(
    async (line: number) => {
      if (!selectedList || content == null) return;

      const lines = content.split("\n");
      if (line < 0 || line >= lines.length) return;

      const prev = content;
      lines.splice(line, 1);
      const next = lines.join("\n");

      setContent(next);
      setItems(parse(next));

      try {
        await writeFile(`${listsDirPath}/${selectedList}`, next);
      } catch (e) {
        setContent(prev);
        setItems(parse(prev));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [content, listsDirPath, selectedList, parse],
  );

  const startEditing = useCallback((line: number, currentText: string) => {
    setEditingLine(line);
    setEditingText(currentText);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingLine(null);
    setEditingText("");
  }, []);

  const saveEditing = useCallback(async () => {
    if (editingLine == null || !selectedList || content == null) return;

    const next = replaceTodoTextAtLine(content, editingLine, editingText.trim());

    setContent(next);
    setItems(parse(next));
    setEditingLine(null);
    setEditingText("");

    try {
      await writeFile(`${listsDirPath}/${selectedList}`, next);
    } catch (e) {
      // Revert
      setContent(content);
      setItems(parse(content));
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [content, editingLine, editingText, listsDirPath, selectedList, parse]);

  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let cancelled = false;

    (async () => {
      try {
        await ensureDirExists(listsDirPath, true);
        await refreshLists();

        const ac = new AbortController();
        dirAbortRef.current = ac;

        cleanup = await watchDirectory(
          listsDirPath,
          (changes) => {
            if (cancelled) return;
            const selected = selectedList;

            let needsListRefresh = false;
            let needsItemRefresh = false;

            for (const c of changes) {
              const p = c.path.join("/");
              if (c.type === "appeared" || c.type === "disappeared") needsListRefresh = true;
              if (selected && p === selected && (c.type === "modified" || c.type === "appeared"))
                needsItemRefresh = true;
            }

            if (needsListRefresh) refreshLists();
            if (needsItemRefresh && selected) readAndParse(selected);
          },
          { recursive: false, emitInitial: false, signal: ac.signal },
        );
      } catch (e) {
        // Watching failure is non-fatal
        console.warn("Todo watcher error", e);
      }
    })();

    return () => {
      cancelled = true;
      dirAbortRef.current?.abort();
      cleanup?.();
    };
  }, [listsDirPath, refreshLists, readAndParse, selectedList]);

  return (
    <>
      <Box height="100%" display="flex" flexDirection="column" gap={isMobile ? "sm" : "0"}>
        {isMobile && (
          <Button
            size="md"
            variant="outline"
            minHeight="44px"
            alignSelf="flex-start"
            onClick={() => setContentVisible((prev) => !prev)}
            aria-expanded={contentVisible}
          >
            {contentVisible ? "Hide todos" : "Show todos"}
          </Button>
        )}
        {(!isMobile || contentVisible) && (
          <Box height="100%" display="flex" flexDirection="column">
            <Box
              flex="1"
              overflow="hidden"
              display="flex"
              flexDirection={isMobile ? "column" : "row"}
              gap={isMobile ? "sm" : "0"}
            >
              {/* Left: lists */}
              <Box
                width={isMobile ? "100%" : "260px"}
                borderRightWidth={isMobile ? "0" : "1px"}
                borderBottomWidth={isMobile ? "1px" : "0"}
                borderColor="border.secondary"
                overflowY="auto"
                padding={isMobile ? "md" : "sm"}
              >
                <HStack
                  gap="sm"
                  marginBottom="3"
                  borderBottom="1px solid"
                  borderColor="border.secondary"
                  paddingBottom="sm"
                  align="center"
                  flexWrap={isMobile ? "wrap" : "nowrap"}
                >
                  <Input
                    value={newListName}
                    onChange={(e) => setNewListName(e.currentTarget.value)}
                    placeholder="New list name"
                    size={isMobile ? "md" : "sm"}
                    width={isMobile ? "100%" : "180px"}
                  />
                  <Button size={isMobile ? "md" : "sm"} minHeight={isMobile ? "44px" : undefined} onClick={addList}>
                    Add List
                  </Button>
                </HStack>

                {lists.length === 0 && (
                  <Text fontSize={isMobile ? "md" : "sm"} color="fg.secondary">
                    No todo lists. Create one above.
                  </Text>
                )}

                {lists.length > 0 && (
                  <VStack align="stretch" gap="xs">
                    {lists.map((name) => {
                      const selected = name === selectedList;
                      return (
                        <HStack
                          key={name}
                          justify="space-between"
                          align="center"
                          paddingX="sm"
                          paddingY={isMobile ? "sm" : "1.5"}
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: "background.secondary" }}
                          onClick={() => selectList(name)}
                          textDecoration={selected ? "underline" : "none"}
                          gap="sm"
                        >
                          <Text fontSize={isMobile ? "md" : "sm"} title={name} flex="1">
                            {displayListName(name)}
                          </Text>
                          <IconButton
                            size={isMobile ? "md" : "xs"}
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDeleteList(name);
                            }}
                            colorPalette="red"
                            minHeight={isMobile ? "44px" : undefined}
                          >
                            <Trash2 size={isMobile ? 18 : 12} />
                          </IconButton>
                        </HStack>
                      );
                    })}
                  </VStack>
                )}
              </Box>

              {/* Right: items of selected list */}
              <Box flex="1" overflowY="auto" padding={isMobile ? "md" : "3"}>
                <Box maxW="720px" mx="auto">
                  {selectedList && (
                    <HStack justify="space-between" align="center" marginBottom="3">
                      <HStack>
                        <Text fontSize={isMobile ? "xl" : "lg"} color="fg.secondary">
                          {displayListName(selectedList)}
                        </Text>
                      </HStack>
                    </HStack>
                  )}

                  {!error && selectedList && (
                    <VStack align="stretch" gap="3">
                      <HStack align={isMobile ? "stretch" : "center"} gap="sm" flexWrap={isMobile ? "wrap" : "nowrap"}>
                        <Input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.currentTarget.value)}
                          placeholder="Add a new todo"
                          size={isMobile ? "md" : "sm"}
                        />
                        <Button
                          size={isMobile ? "md" : "sm"}
                          minHeight={isMobile ? "44px" : undefined}
                          onClick={addItem}
                          disabled={!newItemText.trim()}
                        >
                          Add
                        </Button>
                      </HStack>

                      {items.length === 0 && (
                        <Text fontSize={isMobile ? "md" : "sm"} color="fg.secondary">
                          Todo list is empty.
                        </Text>
                      )}

                      {items.length > 0 && (
                        <VStack align="stretch" gap="sm">
                          {items.map((t) => (
                            <HStack
                              key={t.line}
                              justify="space-between"
                              align="center"
                              gap="sm"
                              paddingY={isMobile ? "sm" : "xs"}
                            >
                              <Checkbox.Root
                                width="100%"
                                cursor="pointer"
                                checked={t.done}
                                onCheckedChange={(e) => setChecked(t.line, !!e.checked)}
                              >
                                <HStack align="center" gap="sm">
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control
                                    cursor="pointer"
                                    boxSize={isMobile ? "1.5rem" : undefined}
                                  />
                                  <Checkbox.Label cursor="pointer">
                                    {editingLine === t.line ? (
                                      <Input
                                        size={isMobile ? "md" : "xs"}
                                        autoFocus
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.currentTarget.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditing();
                                          if (e.key === "Escape") cancelEditing();
                                        }}
                                      />
                                    ) : (
                                      <Text
                                        fontSize={isMobile ? "md" : "sm"}
                                        textDecoration={t.done ? "line-through" : "none"}
                                        color={t.done ? "fg.muted" : "fg.primary"}
                                        onDoubleClick={() => startEditing(t.line, t.text)}
                                      >
                                        {t.text || "(empty)"}
                                      </Text>
                                    )}
                                  </Checkbox.Label>
                                </HStack>
                              </Checkbox.Root>
                              <HStack gap="sm">
                                {editingLine === t.line ? (
                                  <Button
                                    size={isMobile ? "md" : "xs"}
                                    minHeight={isMobile ? "44px" : undefined}
                                    onClick={saveEditing}
                                  >
                                    Save
                                  </Button>
                                ) : (
                                  <IconButton
                                    size={isMobile ? "md" : "xs"}
                                    variant="ghost"
                                    onClick={() => startEditing(t.line, t.text)}
                                    minHeight={isMobile ? "44px" : undefined}
                                  >
                                    <PencilIcon size={isMobile ? 18 : 14} />
                                  </IconButton>
                                )}
                                <IconButton
                                  size={isMobile ? "md" : "xs"}
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() => removeItem(t.line)}
                                  minHeight={isMobile ? "44px" : undefined}
                                >
                                  <Trash2 size={isMobile ? 18 : 14} />
                                </IconButton>
                              </HStack>
                            </HStack>
                          ))}
                        </VStack>
                      )}
                    </VStack>
                  )}

                  {!selectedList && (
                    <Text fontSize={isMobile ? "md" : "sm"} color="fg.secondary">
                      Select or create a list.
                    </Text>
                  )}

                  {error && (
                    <Text fontSize={isMobile ? "md" : "sm"} color="red.400">
                      {String(error)}
                    </Text>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={cancelDeleteList}
        onDelete={confirmDeleteList}
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
