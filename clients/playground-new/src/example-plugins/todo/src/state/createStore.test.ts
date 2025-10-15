import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTodoStore, TODO_LISTS_DIR, type TodoStoreDependencies } from "./createStore";
import type { TodoFileEntry } from "../opfs";

const createDependencies = () => {
  const ensureDir = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const listFiles = vi.fn<(path: string) => Promise<TodoFileEntry[]>>().mockResolvedValue([]);
  const readFile = vi.fn<(path: string) => Promise<string>>().mockResolvedValue("- [ ] Task\n");
  const writeFile = vi.fn<(path: string, contents: string) => Promise<void>>().mockResolvedValue(undefined);
  const deleteFile = vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);

  const deps: TodoStoreDependencies = {
    fs: { ensureDir, listFiles, readFile, writeFile, deleteFile },
  };

  return { deps, ensureDir, listFiles, readFile, writeFile, deleteFile };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTodoStore", () => {
  it("initializes and selects the first todo list", async () => {
    const { deps, ensureDir, listFiles } = createDependencies();
    listFiles.mockResolvedValueOnce([
      { name: "work.md", path: "plugin_data/todo/work.md", kind: "file" as const },
      { name: "alpha.md", path: "plugin_data/todo/alpha.md", kind: "file" as const },
    ]);

    const store = createTodoStore(deps);
    await store.getState().initialize();

    expect(ensureDir).toHaveBeenCalledWith(TODO_LISTS_DIR);
    expect(listFiles).toHaveBeenCalledWith(TODO_LISTS_DIR);
    expect(store.getState().lists).toEqual(["alpha.md", "work.md"]);
    expect(store.getState().selectedList).toBe("alpha.md");
  });

  it("writes updated content when toggling a todo item", async () => {
    const { deps, listFiles, readFile, writeFile } = createDependencies();
    listFiles.mockResolvedValue([{ name: "demo.md", path: "plugin_data/todo/demo.md", kind: "file" as const }]);
    readFile.mockResolvedValue("- [ ] Task\n");

    const store = createTodoStore(deps);
    await store.getState().refreshLists();

    expect(store.getState().selectedList).toBe("demo.md");

    await store.getState().setChecked(0, true);

    expect(writeFile).toHaveBeenLastCalledWith(`${TODO_LISTS_DIR}/demo.md`, "- [x] Task\n");
  });
});
