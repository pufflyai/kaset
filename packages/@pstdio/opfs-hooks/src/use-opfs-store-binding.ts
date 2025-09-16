import {
  bindStoreToJsonFile,
  createJsonFileStorage,
  type BindStoreOptions,
  type JsonFileStorageOptions,
  type StoreAdapter,
} from "@pstdio/opfs-utils";
import { useEffect } from "react";

export interface UseOpfsStoreBindingParams<T> {
  store: StoreAdapter<T>;
  storageOptions: JsonFileStorageOptions<T>;
  bindOptions?: BindStoreOptions<T>;
  onError?: (error: unknown) => void;
}

export function useOpfsStoreBinding<T>(params: UseOpfsStoreBindingParams<T>): void {
  const { store, storageOptions, bindOptions, onError } = params;

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const storage = createJsonFileStorage(storageOptions);

    (async () => {
      try {
        const dispose = await bindStoreToJsonFile(store, storage, bindOptions);
        if (cancelled) {
          dispose();
        } else {
          cleanup = dispose;
        }
      } catch (error) {
        storage.dispose();
        if (onError) {
          onError(error);
        } else {
          console.error("useOpfsStoreBinding: failed to bind store", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) {
        cleanup();
      } else {
        storage.dispose();
      }
    };
  }, [store, storageOptions, bindOptions, onError]);
}
