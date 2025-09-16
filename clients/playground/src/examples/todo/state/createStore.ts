import { PROJECTS_ROOT } from "@/constant";
import { persistToOpfs } from "@/services/state/opfsPersist";
import { deleteFile, ensureDirExists, ls, readFile, writeFile } from "@pstdio/opfs-utils";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { TodoItem, TodoStore } from "./types";

export const TODO_LISTS_DIR = `${PROJECTS_ROOT}/todo/todos`;
const TODO_STORE_PERSIST_KEY = "kaset-todo-store";
const TODO_STORE_PERSIST_VERSION = 1;
const DEFAULT_PERSIST_FILE = `${PROJECTS_ROOT}/todo/.state/todo-store.json`;

type TodoStorePersistedState = Partial<
  Pick<
    TodoStore,
    | "selectedList"
    | "newListName"
    | "newItemText"
    | "editingLine"
    | "editingText"
    | "deleteModalOpen"
    | "pendingDeleteList"
  >
>;

const defaultPartialize = (state: TodoStore): TodoStorePersistedState => ({
  selectedList: state.selectedList,
  newListName: state.newListName,
  newItemText: state.newItemText,
  editingLine: state.editingLine,
  editingText: state.editingText,
  deleteModalOpen: state.deleteModalOpen,
  pendingDeleteList: state.pendingDeleteList,
});

export interface TodoStoreOptions {
  /** Override the OPFS path used for persisting todo UI state. */
  persistFilePath?: string;
  /** Customize which pieces of the todo store state are persisted. */
  persistPartialize?: (state: TodoStore) => Partial<TodoStore>;
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

export const createTodoStore = (options: TodoStoreOptions = {}) => {
  const persistFilePath = options.persistFilePath ?? DEFAULT_PERSIST_FILE;
  const partialize = options.persistPartialize ?? defaultPartialize;

  return create<TodoStore>()(
    persistToOpfs(
      devtools(
        immer<TodoStore>((set, get) => ({
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
          setNewListName: (value: string) => set({ newListName: value }),
          setNewItemText: (value: string) => set({ newItemText: value }),
          setEditingText: (value: string) => set({ editingText: value }),
          refreshLists: async () => {
            const previousSelected = get().selectedList;
            try {
              set({ error: null });
              await ensureDirExists(TODO_LISTS_DIR, true);
              const entries = await ls(TODO_LISTS_DIR, { maxDepth: 1, kinds: ["file"], include: ["*.md"] });
              const names = entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
              const nextSelected = names.includes(previousSelected ?? "") ? previousSelected : (names[0] ?? null);

              set({
                lists: names,
                selectedList: nextSelected,
                ...(nextSelected ? {} : { content: null, items: [] }),
              });

              if (nextSelected) {
                await get().readAndParse(nextSelected);
              }
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) });
            }
          },
          readAndParse: async (fileName: string) => {
            const path = `${TODO_LISTS_DIR}/${fileName}`;
            try {
              const md = await readFile(path);
              set({
                content: md,
                items: parseMarkdownTodos(md),
                error: null,
              });
            } catch (error: any) {
              if (error?.name === "NotFoundError") {
                set({ error: `File not found: ${path}` });
              } else {
                set({ error: error instanceof Error ? error.message : String(error) });
              }
            }
          },
          selectList: async (name: string) => {
            set({ selectedList: name });
            await get().readAndParse(name);
          },
          addList: async () => {
            const { newListName } = get();
            const raw = (newListName || "New List").trim();
            if (!raw) return;

            const name = raw.toLowerCase().endsWith(".md") ? raw : `${raw}.md`;
            const path = `${TODO_LISTS_DIR}/${name}`;

            try {
              await writeFile(path, "- [ ] New item\n");
              set({ newListName: "" });
              await get().refreshLists();
              await get().selectList(name);
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) });
            }
          },
          removeList: async (name: string) => {
            const path = `${TODO_LISTS_DIR}/${name}`;
            try {
              await deleteFile(path);
              if (get().selectedList === name) {
                set({ selectedList: null, content: null, items: [] });
              }
              await get().refreshLists();
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) });
            }
          },
          requestDeleteList: (name: string) => set({ pendingDeleteList: name, deleteModalOpen: true }),
          cancelDeleteList: () => set({ deleteModalOpen: false, pendingDeleteList: null }),
          confirmDeleteList: async () => {
            const { pendingDeleteList } = get();
            if (!pendingDeleteList) return;

            await get().removeList(pendingDeleteList);
            set({ pendingDeleteList: null, deleteModalOpen: false });
          },
          setChecked: async (line: number, checked: boolean) => {
            const { selectedList, content } = get();
            if (!selectedList || content == null) return;

            const previous = content;
            const next = toggleCheckboxAtLine(content, line, checked);

            set({ content: next, items: parseMarkdownTodos(next) });

            try {
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
            } catch (error) {
              set({
                content: previous,
                items: parseMarkdownTodos(previous),
                error: error instanceof Error ? error.message : String(error),
              });
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

            set({ content: next, items: parseMarkdownTodos(next), newItemText: "" });

            try {
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
            } catch (error) {
              set({
                content: previous,
                items: parseMarkdownTodos(previous),
                error: error instanceof Error ? error.message : String(error),
              });
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

            set({ content: next, items: parseMarkdownTodos(next) });

            try {
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
            } catch (error) {
              set({
                content: previous,
                items: parseMarkdownTodos(previous),
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
          startEditing: (line: number, currentText: string) => set({ editingLine: line, editingText: currentText }),
          cancelEditing: () => set({ editingLine: null, editingText: "" }),
          saveEditing: async () => {
            const { editingLine, selectedList, content, editingText } = get();
            if (editingLine == null || !selectedList || content == null) return;

            const next = replaceTodoTextAtLine(content, editingLine, editingText.trim());

            set({ content: next, items: parseMarkdownTodos(next), editingLine: null, editingText: "" });

            try {
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
            } catch (error) {
              set({
                content,
                items: parseMarkdownTodos(content),
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
          initialize: async () => {
            try {
              await get().refreshLists();
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) });
            }
          },
          setError: (message: string | null) => set({ error: message }),
        })),
        { name: "TodoStore" },
      ),
      {
        name: TODO_STORE_PERSIST_KEY,
        filePath: persistFilePath,
        version: TODO_STORE_PERSIST_VERSION,
        partialize,
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<TodoStore>),
        }),
      },
    ),
  );
};
