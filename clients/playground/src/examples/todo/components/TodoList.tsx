import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Box, Button, Checkbox, HStack, IconButton, Spinner, Text, VStack } from "@chakra-ui/react";
import { getDirectoryHandle, readFile, watchDirectory, writeFile } from "@pstdio/opfs-utils";
import { SquarePen as EditIcon, RefreshCw as RefreshIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TodoListProps {
  /** OPFS root folder for the playground (e.g., "playground"). */
  rootDir?: string;
  /** File name (within the rootDir) to read/write. Default: "todo.md" */
  fileName?: string;
}

type TodoItem = {
  /** 0-based line index within the file */
  line: number;
  /** Raw text after the checkbox */
  text: string;
  /** Whether the item is checked */
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

function toggleCheckboxAtLine(md: string, lineIndex: number): string {
  const lines = md.split("\n");
  const line = lines[lineIndex] ?? "";

  const toggled = line.replace(/(\s*[-*]\s*\[)( |x|X)(\]\s*)/, (_m, p1, p2, p3) => {
    const next = p2.toLowerCase() === "x" ? " " : "x";
    return `${p1}${next}${p3}`;
  });

  lines[lineIndex] = toggled;
  return lines.join("\n");
}

export function TodoList(props: TodoListProps) {
  const rootDir = (props.rootDir ?? "playground").replace(/\/+$/, "");
  const fileName = props.fileName ?? "todo.md";
  const filePath = `${rootDir}/${fileName}`;

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [items, setItems] = useState<TodoItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const parse = useCallback((md: string) => parseMarkdownTodos(md), []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const md = await readFile(filePath);
      setContent(md);
      setItems(parse(md));
    } catch (e: any) {
      setError(e?.name === "NotFoundError" ? `File not found: ${filePath}` : (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }, [filePath, parse]);

  const toggle = useCallback(
    async (line: number) => {
      if (content == null) return;
      const next = toggleCheckboxAtLine(content, line);

      // Optimistically update UI
      setContent(next);
      setItems(parse(next));

      try {
        await writeFile(filePath, next);
      } catch (e) {
        // Revert on failure
        setContent(content);
        setItems(parse(content));
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [content, filePath, parse],
  );

  // Watch for external changes within the rootDir and update if todo.md changed
  useEffect(() => {
    let cleanup: null | (() => void) = null;
    let cancelled = false;

    (async () => {
      try {
        const dir = await getDirectoryHandle(rootDir);
        const ac = new AbortController();
        abortRef.current = ac;

        cleanup = await watchDirectory(
          dir,
          (changes) => {
            if (cancelled) return;
            const target = `${filePath}`.replace(/\\/g, "/");
            const changed = changes.some((c) => c.path.join("/") === target);
            if (changed) refresh();
          },
          { recursive: false, emitInitial: false, signal: ac.signal },
        );
      } catch {
        // Non-fatal if watching fails
        // console.warn("Todo watcher error", e);
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      cleanup?.();
    };
  }, [rootDir, filePath, refresh]);

  const openInEditor = useCallback(() => {
    useWorkspaceStore.setState(
      (state) => {
        state.local.filePath = filePath;
      },
      false,
      "file/select/todo-md",
    );
  }, [filePath]);

  const header = useMemo(() => {
    return (
      <HStack justify="space-between" align="center" paddingX="3" paddingY="2" borderBottomWidth="1px">
        <HStack gap="2" align="center">
          <Text fontSize="sm" color="fg.secondary">
            Todos
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {fileName}
          </Text>
        </HStack>
        <HStack>
          <Button size="xs" variant="ghost" onClick={openInEditor}>
            <HStack gap="1" align="center">
              <EditIcon size={14} />
              <Text>Open file</Text>
            </HStack>
          </Button>
          <IconButton aria-label="Refresh" size="xs" variant="ghost" onClick={refresh}>
            <RefreshIcon size={14} />
          </IconButton>
        </HStack>
      </HStack>
    );
  }, [fileName, openInEditor, refresh]);

  return (
    <Box height="100%" display="flex" flexDirection="column">
      {header}
      <Box flex="1" overflowY="auto" padding="3">
        {loading && (
          <HStack color="fg.secondary" gap="2">
            <Spinner size="xs" />
            <Text fontSize="sm">Loading…</Text>
          </HStack>
        )}

        {!loading && !error && items.length === 0 && (
          <Text fontSize="sm" color="fg.secondary">
            No todo items found in {fileName}. Use "- [ ] Task" markdown.
          </Text>
        )}

        {!loading && !error && items.length > 0 && (
          <VStack align="stretch" gap="2">
            {items.map((t) => (
              <Checkbox.Root key={t.line} checked={t.done} onCheckedChange={() => toggle(t.line)} colorPalette="teal">
                <HStack>
                  <Checkbox.Control />
                  <Checkbox.Label>
                    <Text
                      fontSize="sm"
                      textDecoration={t.done ? "line-through" : "none"}
                      color={t.done ? "fg.muted" : "fg.primary"}
                    >
                      {t.text || "(empty)"}
                    </Text>
                  </Checkbox.Label>
                </HStack>
              </Checkbox.Root>
            ))}
          </VStack>
        )}
      </Box>
    </Box>
  );
}

export default TodoList;
