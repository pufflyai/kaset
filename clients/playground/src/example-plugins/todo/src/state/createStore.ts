import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { FsScope, TinyUiHost } from "../host";
import type { TodoItem, TodoStore } from "./types";

const TODO_SCOPE: FsScope = "data";
export const TODO_LISTS_DIR = "lists";

const textDecoder = new TextDecoder();
const HOST_CALL_MAX_ATTEMPTS = 5;
const HOST_CALL_RETRY_DELAY_MS = 80;
const RETRYABLE_HOST_ERROR_PATTERNS = [
  /Tiny UI host ops handler not registered/i,
  /message port closed before a response was received/i,
  /connection (?:is )?(?:closing|closed)/i,
  /target frame has been detached/i,
];

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  const record = error as { message?: unknown };
  if (typeof record.message === "string") return record.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableHostError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name } = error as { name?: unknown };
  if (name === "NotFoundError") return false;
  const message = getErrorMessage(error);
  if (!message) return false;
  return RETRYABLE_HOST_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function callHost<T>(
  host: TinyUiHost,
  method: string,
  params?: Record<string, unknown>,
  attempt = 0,
): Promise<T> {
  try {
    return await host.call<T>(method, params);
  } catch (error) {
    if (attempt >= HOST_CALL_MAX_ATTEMPTS - 1 || !isRetryableHostError(error)) {
      throw error;
    }

    await wait(HOST_CALL_RETRY_DELAY_MS * (attempt + 1));
    return callHost<T>(host, method, params, attempt + 1);
  }
}

// IN THE FUTURE WE SHOULD NOT SERIALIZE/DE-SERIALIZE ARRAY BUFFERS LIKE THIS
// WE NEED TO UPGRADE RIMLESS

function isNodeBufferLike(value: unknown): value is { type: "Buffer"; data: number[] } {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const record = value as { type?: unknown; data?: unknown };
  return record.type === "Buffer" && Array.isArray(record.data);
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }

  if (isNodeBufferLike(value)) {
    return Uint8Array.from(value.data);
  }

  throw new Error("Unsupported file contents");
}

function decodeFileContents(value: unknown): string {
  if (typeof value === "string") return value;
  const bytes = toUint8Array(value);
  return textDecoder.decode(bytes);
}

function parseMarkdownTodos(md: string): TodoItem[] {
  const lines = md.split("\n");

  const items: TodoItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = /^\s*[-*]\s*\[( |x|X)\]\s*(.*)$/.exec(line);
    if (!match) continue;

    const done = match[1].toLowerCase() === "x";
    const text = match[2] ?? "";

    items.push({ line: i, text, done });
  }

  return items;
}

function toggleCheckboxAtLine(md: string, lineIndex: number, checked: boolean): string {
  const lines = md.split("\n");
  const line = lines[lineIndex] ?? "";

  const toggled = line.replace(/(\s*[-*]\s*\[)( |x|X)(\]\s*)/, (_match, prefix, _current, suffix) => {
    const next = checked ? "x" : " ";
    return `${prefix}${next}${suffix}`;
  });

  lines[lineIndex] = toggled;
  return lines.join("\n");
}

function replaceTodoTextAtLine(md: string, lineIndex: number, nextText: string): string {
  const lines = md.split("\n");
  const line = lines[lineIndex] ?? "";

  const replaced = line.replace(/^(\s*[-*]\s*\[(?: |x|X)\]\s*)(.*)$/u, (_match, prefix) => `${prefix}${nextText}`);

  lines[lineIndex] = replaced;
  return lines.join("\n");
}

const joinListPath = (name: string) => (TODO_LISTS_DIR ? `${TODO_LISTS_DIR}/${name}` : name);

const listMarkdownFiles = async (host: TinyUiHost) => {
  const entries = await callHost<Array<{ name: string }>>(host, "fs.ls", {
    path: TODO_LISTS_DIR,
    scope: TODO_SCOPE,
    options: { maxDepth: 1, kinds: ["file"], include: ["*.md"] },
  });

  return entries.map((entry) => entry.name);
};

export const createTodoStore = (host: TinyUiHost) =>
  create<TodoStore>()(
    devtools(
      immer((set, get) => {
        const setState = (partial: Partial<TodoStore>, action: string) => set(partial, false, action);

        return {
          error: null,
          lists: [],
          selectedList: null,
          content: null,
          items: [],
          newListName: "",
          newItemText: "",
          editingLine: null,
          editingText: "",
          deleteModalOpen: false,
          pendingDeleteList: null,
          setNewListName: (value: string) => setState({ newListName: value }, "todo/setNewListName"),
          setNewItemText: (value: string) => setState({ newItemText: value }, "todo/setNewItemText"),
          setEditingText: (value: string) => setState({ editingText: value }, "todo/setEditingText"),
          setError: (message: string | null) => setState({ error: message }, "todo/setError"),
          refreshLists: async () => {
            const previousSelected = get().selectedList;

            try {
              setState({ error: null }, "todo/refreshLists:resetError");
              await callHost(host, "fs.mkdirp", { path: TODO_LISTS_DIR, scope: TODO_SCOPE });

              const names = (await listMarkdownFiles(host)).sort((a, b) => a.localeCompare(b));
              const nextSelected = names.includes(previousSelected ?? "") ? previousSelected : (names[0] ?? null);

              setState(
                {
                  lists: names,
                  selectedList: nextSelected,
                  ...(nextSelected ? {} : { content: null, items: [] }),
                },
                "todo/refreshLists:updateLists",
              );

              if (nextSelected) {
                await get().readAndParse(nextSelected);
              }
            } catch (error) {
              setState({ error: error instanceof Error ? error.message : String(error) }, "todo/refreshLists:error");
            }
          },
          readAndParse: async (fileName: string) => {
            const path = joinListPath(fileName);

            try {
              const contents = await callHost(host, "fs.readFile", { path, scope: TODO_SCOPE });
              const md = decodeFileContents(contents);

              setState(
                {
                  content: md,
                  items: parseMarkdownTodos(md),
                  error: null,
                },
                "todo/readAndParse:success",
              );
            } catch (error: any) {
              if (error?.name === "NotFoundError") {
                setState({ error: `File not found: ${path}` }, "todo/readAndParse:notFound");
              } else {
                setState({ error: error instanceof Error ? error.message : String(error) }, "todo/readAndParse:error");
              }
            }
          },
          selectList: async (name: string) => {
            setState({ selectedList: name }, "todo/selectList:setSelected");
            await get().readAndParse(name);
          },
          addList: async () => {
            const { newListName } = get();
            const raw = (newListName || "New List").trim();
            if (!raw) return;

            const name = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
            const path = joinListPath(name);

            try {
              await callHost(host, "fs.writeFile", { path, contents: "- [ ] New item\n", scope: TODO_SCOPE });
              setState({ newListName: "" }, "todo/addList:resetNewListName");

              await get().refreshLists();
              await get().selectList(name);
            } catch (error) {
              setState({ error: error instanceof Error ? error.message : String(error) }, "todo/addList:error");
            }
          },
          removeList: async (name: string) => {
            const path = joinListPath(name);

            try {
              await callHost(host, "fs.deleteFile", { path, scope: TODO_SCOPE });

              if (get().selectedList === name) {
                setState({ selectedList: null, content: null, items: [] }, "todo/removeList:clearSelected");
              }

              await get().refreshLists();
            } catch (error) {
              setState({ error: error instanceof Error ? error.message : String(error) }, "todo/removeList:error");
            }
          },
          requestDeleteList: (name: string) =>
            setState({ pendingDeleteList: name, deleteModalOpen: true }, "todo/requestDeleteList"),
          cancelDeleteList: () =>
            setState({ deleteModalOpen: false, pendingDeleteList: null }, "todo/cancelDeleteList"),
          confirmDeleteList: async () => {
            const { pendingDeleteList } = get();
            if (!pendingDeleteList) return;

            await get().removeList(pendingDeleteList);

            setState({ pendingDeleteList: null, deleteModalOpen: false }, "todo/confirmDeleteList:closeModal");
          },
          setChecked: async (line: number, checked: boolean) => {
            const { selectedList, content } = get();
            if (!selectedList || content == null) return;

            const previous = content;
            const next = toggleCheckboxAtLine(content, line, checked);

            setState({ content: next, items: parseMarkdownTodos(next) }, "todo/setChecked:update");

            try {
              await callHost(host, "fs.writeFile", {
                path: joinListPath(selectedList),
                contents: next,
                scope: TODO_SCOPE,
              });
            } catch (error) {
              setState(
                {
                  content: previous,
                  items: parseMarkdownTodos(previous),
                  error: error instanceof Error ? error.message : String(error),
                },
                "todo/setChecked:error",
              );
            }
          },
          addItem: async () => {
            const { selectedList, content, newItemText } = get();
            if (!selectedList) return;

            const text = newItemText.trim();
            if (!text) return;

            const previous = content ?? "";
            const prefix = previous.endsWith("\n") || previous.length === 0 ? "" : "\n";
            const next = previous + prefix + `- [ ] ${text}\n`;

            setState({ content: next, items: parseMarkdownTodos(next), newItemText: "" }, "todo/addItem:apply");

            try {
              await callHost(host, "fs.writeFile", {
                path: joinListPath(selectedList),
                contents: next,
                scope: TODO_SCOPE,
              });
            } catch (error) {
              setState(
                {
                  content: previous,
                  items: parseMarkdownTodos(previous),
                  error: error instanceof Error ? error.message : String(error),
                },
                "todo/addItem:error",
              );
            }
          },
          removeItem: async (line: number) => {
            const { selectedList, content } = get();
            if (!selectedList || content == null) return;

            const lines = content.split("\n");
            if (line < 0 || line >= lines.length) return;

            const previous = content;
            lines.splice(line, 1);
            const next = lines.join("\n");

            setState({ content: next, items: parseMarkdownTodos(next) }, "todo/removeItem:apply");

            try {
              await callHost(host, "fs.writeFile", {
                path: joinListPath(selectedList),
                contents: next,
                scope: TODO_SCOPE,
              });
            } catch (error) {
              setState(
                {
                  content: previous,
                  items: parseMarkdownTodos(previous),
                  error: error instanceof Error ? error.message : String(error),
                },
                "todo/removeItem:error",
              );
            }
          },
          startEditing: (line: number, currentText: string) =>
            setState({ editingLine: line, editingText: currentText }, "todo/startEditing"),
          cancelEditing: () => setState({ editingLine: null, editingText: "" }, "todo/cancelEditing"),
          saveEditing: async () => {
            const { editingLine, selectedList, content, editingText } = get();
            if (editingLine == null || !selectedList || content == null) return;

            const next = replaceTodoTextAtLine(content, editingLine, editingText.trim());

            setState(
              { content: next, items: parseMarkdownTodos(next), editingLine: null, editingText: "" },
              "todo/saveEditing:apply",
            );

            try {
              await callHost(host, "fs.writeFile", {
                path: joinListPath(selectedList),
                contents: next,
                scope: TODO_SCOPE,
              });
            } catch (error) {
              setState(
                {
                  content,
                  items: parseMarkdownTodos(content),
                  error: error instanceof Error ? error.message : String(error),
                },
                "todo/saveEditing:error",
              );
            }
          },
          initialize: async () => {
            try {
              await callHost(host, "fs.mkdirp", { path: TODO_LISTS_DIR, scope: TODO_SCOPE });

              await get().refreshLists();
            } catch (error) {
              setState({ error: error instanceof Error ? error.message : String(error) }, "todo/initialize:error");
            }
          },
        };
      }),
      { name: "TodoStore" },
    ),
  );
