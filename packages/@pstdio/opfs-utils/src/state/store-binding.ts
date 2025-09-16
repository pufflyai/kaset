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

export interface ReduxStoreLike<T> {
  getState(): T;
  dispatch(action: unknown): void;
  subscribe(listener: () => void): () => void;
}

export function createReduxAdapter<T>(store: ReduxStoreLike<T>, hydrateAction: (next: T) => unknown): StoreAdapter<T> {
  return {
    read: () => store.getState(),
    replace: (next) => {
      store.dispatch(hydrateAction(next));
    },
    subscribe: (listener) => store.subscribe(listener),
  } satisfies StoreAdapter<T>;
}

export interface ZustandStoreLike<T> {
  getState(): T;
  setState(partial: T | ((state: T) => T), replace?: boolean): void;
  subscribe(listener: (state: T, prevState: T) => void): () => void;
}

export function createZustandAdapter<T>(store: ZustandStoreLike<T>): StoreAdapter<T> {
  return {
    read: () => store.getState(),
    replace: (next) => {
      store.setState(next, true);
    },
    subscribe: (listener) => store.subscribe(() => listener()),
  } satisfies StoreAdapter<T>;
}

export interface JotaiStoreLike<TAtom, TValue> {
  get(atom: TAtom): TValue;
  set(atom: TAtom, value: TValue): void;
  sub?(atom: TAtom, callback: () => void): () => void;
}

export interface CreateJotaiAdapterOptions {
  /** Provide a fallback subscription when store.sub is unavailable. */
  fallbackSubscribe?: (listener: () => void) => () => void;
}

export function createJotaiAdapter<TValue, TAtom>(
  store: JotaiStoreLike<TAtom, TValue>,
  atom: TAtom,
  options: CreateJotaiAdapterOptions = {},
): StoreAdapter<TValue> {
  const { fallbackSubscribe } = options;

  return {
    read: () => store.get(atom),
    replace: (next) => {
      store.set(atom, next);
    },
    subscribe: (listener) => {
      if (typeof store.sub === "function") {
        return store.sub(atom, listener);
      }
      if (fallbackSubscribe) {
        return fallbackSubscribe(listener);
      }
      throw new Error(
        "createJotaiAdapter: jotaiStore.sub is unavailable. Provide options.fallbackSubscribe to observe atom changes.",
      );
    },
  } satisfies StoreAdapter<TValue>;
}
