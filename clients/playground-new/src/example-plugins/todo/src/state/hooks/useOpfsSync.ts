import { PLUGIN_ROOT } from "@/constant";
import { useOpfsStoreBinding } from "@pstdio/opfs-hooks";
import {
  bindStoreToJsonFile,
  createJsonFileStorage,
  type BindStoreOptions,
  type JsonFileStorageOptions,
  type StoreAdapter,
} from "@pstdio/opfs-utils";
import { useMemo } from "react";
import type { StoreApi } from "zustand";
import type { TodoStore } from "../types";

const DEFAULT_FILE_STATE = { selectedList: "" } as const;

export const TODO_FILE = `${PLUGIN_ROOT}/todo/state.json`;

interface TodoFileState {
  selectedList: string;
}

function migrateTodoState(raw: unknown): TodoFileState {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_FILE_STATE };
  }

  const value = (raw as Record<string, unknown>).selectedList;
  return { selectedList: typeof value === "string" ? value : "" };
}

function createStorageOptions(filePath: string): JsonFileStorageOptions<TodoFileState> {
  return {
    defaultValue: { ...DEFAULT_FILE_STATE },
    filePath,
    debounceMs: 200,
    watchIntervalMs: 1000,
    migrate: migrateTodoState,
  } satisfies JsonFileStorageOptions<TodoFileState>;
}

function toStore(value: string): string | null {
  return value ? value : null;
}

function createAdapter(store: StoreApi<TodoStore>): StoreAdapter<TodoFileState> {
  return {
    read: () => {
      const state = store.getState();
      return { selectedList: state.selectedList ?? "" };
    },
    replace: (next) => {
      const nextSelected = toStore(next.selectedList);
      const current = store.getState().selectedList ?? null;

      if (current === nextSelected) return;

      if (!nextSelected) {
        store.setState({ selectedList: null, content: null, items: [] });
        return;
      }

      store
        .getState()
        .selectList(nextSelected)
        .catch((error) => {
          console.warn("Failed to select list from OPFS binding", error);
        });
    },
    subscribe: (listener) =>
      store.subscribe((state, previous) => {
        const nextSelected = state.selectedList ?? null;
        const prevSelected = previous.selectedList ?? null;

        if (nextSelected === prevSelected) return;

        listener();
      }),
  } satisfies StoreAdapter<TodoFileState>;
}

const DEFAULT_BIND_OPTIONS: BindStoreOptions<TodoFileState> = {
  reconcile: (file) => ({ selectedList: file.selectedList ?? "" }),
};

export interface TodoOpfsConfig {
  filePath?: string;
  bindOptions?: BindStoreOptions<TodoFileState>;
  storageOverrides?: Partial<Omit<JsonFileStorageOptions<TodoFileState>, "defaultValue" | "filePath">>;
}

export async function bindTodoToOpfs(store: StoreApi<TodoStore>, config: TodoOpfsConfig = {}): Promise<() => void> {
  const { filePath = TODO_FILE, bindOptions, storageOverrides } = config;
  const adapter = createAdapter(store);
  const storage = createJsonFileStorage({
    ...createStorageOptions(filePath),
    ...storageOverrides,
  });

  const options: BindStoreOptions<TodoFileState> = {
    ...DEFAULT_BIND_OPTIONS,
    ...bindOptions,
  };

  return bindStoreToJsonFile(adapter, storage, options);
}

export function useOpfsSync(store: StoreApi<TodoStore>, config: TodoOpfsConfig = {}): void {
  const { filePath = TODO_FILE, bindOptions, storageOverrides } = config;

  const adapter = useMemo(() => createAdapter(store), [store]);
  const storageOptions = useMemo(
    () => ({
      ...createStorageOptions(filePath),
      ...storageOverrides,
    }),
    [filePath, storageOverrides],
  );

  const mergedBindOptions = useMemo(
    () => ({
      ...DEFAULT_BIND_OPTIONS,
      ...bindOptions,
    }),
    [bindOptions],
  );

  useOpfsStoreBinding({
    store: adapter,
    storageOptions,
    bindOptions: mergedBindOptions,
  });
}
