import type { JsonFileStorage } from "./json-storage";

export interface StoreAdapter<T> {
  read(): T;
  replace(next: T): void;
  subscribe(listener: () => void): () => void;
}

export interface BindStoreOptions<T> {
  /** Merge OPFS value with in-memory value on initial hydrate. Defaults to file value. */
  reconcile?: (fileValue: T, memoryValue: T) => T;
  /** Equality check to avoid unnecessary writes. Defaults to JSON.stringify comparison. */
  areEqual?: (a: T, b: T) => boolean;
  /** If true (default) write the reconciled value back to disk after hydrating. */
  writeAfterHydrate?: boolean;
}

function defaultAreEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function bindStoreToJsonFile<T>(
  store: StoreAdapter<T>,
  storage: JsonFileStorage<T>,
  options: BindStoreOptions<T> = {},
): Promise<() => void> {
  const { reconcile = (file: T) => file, areEqual = defaultAreEqual, writeAfterHydrate = true } = options;

  let suppressWrite = false;

  const [fileValue, memoryValue] = await Promise.all([storage.read(), Promise.resolve(store.read())]);
  const hydrated = reconcile(fileValue, memoryValue);

  suppressWrite = true;
  store.replace(hydrated);
  suppressWrite = false;

  if (writeAfterHydrate) {
    await storage.write(hydrated);
  }

  const unsubscribeFromStore = store.subscribe(() => {
    if (suppressWrite) return;
    const current = store.read();
    void storage.write(current).catch((error) => {
      console.error("bindStoreToJsonFile: failed to write OPFS state", error);
    });
  });

  const unsubscribeFromStorage = storage.subscribe((next) => {
    const current = store.read();
    if (areEqual(current, next)) return;

    suppressWrite = true;
    try {
      store.replace(next);
    } finally {
      suppressWrite = false;
    }
  });

  return () => {
    unsubscribeFromStore();
    unsubscribeFromStorage();
    storage.dispose();
  };
}
