import { DEFAULT_STATE } from "@/state/defaultState";
import type { WorkspaceStore } from "@/state/types";
import { useOpfsStoreBinding } from "@pstdio/opfs-hooks";
import {
  bindStoreToJsonFile,
  createJsonFileStorage,
  type BindStoreOptions,
  type JsonFileStorageOptions,
} from "@pstdio/opfs-utils";
import { useMemo } from "react";
import type { StoreApi } from "zustand";
import { createZustandAdapter } from "./examples";

export const WORKSPACE_STATE_FILE = "playground/workspace-state.json";

const DEFAULT_BIND_OPTIONS: BindStoreOptions<WorkspaceStore> = {
  reconcile: (file, memory) => ({
    ...memory,
    ...file,
    conversations: { ...memory.conversations, ...file.conversations },
  }),
};

function createStorageOptions(filePath: string): JsonFileStorageOptions<WorkspaceStore> {
  return {
    defaultValue: DEFAULT_STATE,
    filePath,
    debounceMs: 250,
    watchIntervalMs: 1000,
  } satisfies JsonFileStorageOptions<WorkspaceStore>;
}

export interface WorkspaceOpfsConfig {
  filePath?: string;
  bindOptions?: BindStoreOptions<WorkspaceStore>;
  storageOverrides?: Partial<Omit<JsonFileStorageOptions<WorkspaceStore>, "defaultValue" | "filePath">>;
}

export async function bindWorkspaceStoreToOpfs(
  store: StoreApi<WorkspaceStore>,
  config: WorkspaceOpfsConfig = {},
): Promise<() => void> {
  const { filePath = WORKSPACE_STATE_FILE, bindOptions = DEFAULT_BIND_OPTIONS, storageOverrides } = config;
  const storage = createJsonFileStorage({
    ...createStorageOptions(filePath),
    ...storageOverrides,
  });

  return bindStoreToJsonFile(createZustandAdapter(store), storage, bindOptions);
}

export function useWorkspaceStoreOpfsSync(store: StoreApi<WorkspaceStore>, config: WorkspaceOpfsConfig = {}): void {
  const { filePath = WORKSPACE_STATE_FILE, bindOptions = DEFAULT_BIND_OPTIONS, storageOverrides } = config;

  const adapter = useMemo(() => createZustandAdapter(store), [store]);
  const storageOptions = useMemo(
    () => ({
      ...createStorageOptions(filePath),
      ...storageOverrides,
    }),
    [filePath, storageOverrides],
  );

  useOpfsStoreBinding({
    store: adapter,
    storageOptions,
    bindOptions,
  });
}
