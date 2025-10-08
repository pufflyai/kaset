import { deleteFile, ensureDirExists, ls, readFile, writeFile } from "@pstdio/opfs-utils";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { TodoItem, TodoStore } from "./types";

export const ROOT = "playground";
export const PLUGIN_ROOT = `${ROOT}/plugins`;
export const TODO_LISTS_DIR = `${PLUGIN_ROOT}/todo/todos`;

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

export const createTodoStore = () =>
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
              await ensureDirExists(TODO_LISTS_DIR, true);

              const entries = await ls(TODO_LISTS_DIR, { maxDepth: 1, kinds: ["file"], include: ["*.md"] });
              const names = entries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
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
            const path = `${TODO_LISTS_DIR}/${fileName}`;

            try {
              const md = await readFile(path);

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
            const path = `${TODO_LISTS_DIR}/${name}`;

            try {
              await writeFile(path, "- [ ] New item\n");
              setState({ newListName: "" }, "todo/addList:resetNewListName");

              await get().refreshLists();
              await get().selectList(name);
            } catch (error) {
              setState({ error: error instanceof Error ? error.message : String(error) }, "todo/addList:error");
            }
          },
          removeList: async (name: string) => {
            const path = `${TODO_LISTS_DIR}/${name}`;

            try {
              await deleteFile(path);

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
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
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
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
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
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
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
              await writeFile(`${TODO_LISTS_DIR}/${selectedList}`, next);
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
              await ensureDirExists(TODO_LISTS_DIR, true);

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
