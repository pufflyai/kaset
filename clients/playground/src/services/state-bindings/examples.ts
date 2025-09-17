import type { StoreAdapter } from "@pstdio/opfs-utils";

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
