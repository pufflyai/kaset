import { deleteFile, readFile, writeFile } from "@pstdio/opfs-utils";
import type { StateCreator, StoreMutatorIdentifier } from "zustand";
import { createJSONStorage, persist, type PersistOptions, type StateStorage } from "zustand/middleware";

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "NotFoundError"
  );
}

function createOpfsStateStorage(filePath: string) {
  const storage: StateStorage<Promise<void>> = {
    async getItem() {
      try {
        return await readFile(filePath);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        console.warn(`[opfsPersist] Failed to read persisted state from "${filePath}"`, error);
        return null;
      }
    },
    async setItem(_name, value) {
      try {
        await writeFile(filePath, value);
      } catch (error) {
        console.error(`[opfsPersist] Failed to write persisted state to "${filePath}"`, error);
        throw error;
      }
    },
    async removeItem() {
      try {
        await deleteFile(filePath);
      } catch (error) {
        if (isNotFoundError(error)) {
          return;
        }
        console.error(`[opfsPersist] Failed to delete persisted state at "${filePath}"`, error);
        throw error;
      }
    },
  };

  return storage;
}

export interface OpfsPersistOptions<T, PersistedState = Partial<T>>
  extends Omit<PersistOptions<T, PersistedState>, "storage" | "name"> {
  /**
   * OPFS path for the persisted JSON file. The path is treated as relative to the
   * OPFS root and parent directories are created automatically when needed.
   */
  filePath: string;
  /**
   * Optional name used by the devtools extension. Defaults to the file path when
   * omitted.
   */
  name?: string;
}

export function persistToOpfs<
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  PersistedState = Partial<T>,
>(
  initializer: StateCreator<T, [...Mps, ["zustand/persist", unknown]], Mcs>,
  options: OpfsPersistOptions<T, PersistedState>,
): StateCreator<T, Mps, [["zustand/persist", PersistedState], ...Mcs]> {
  const { filePath, name, ...rest } = options;

  return persist(initializer, {
    ...rest,
    name: name ?? filePath,
    storage: createJSONStorage(() => createOpfsStateStorage(filePath)),
  });
}
