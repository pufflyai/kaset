import { useEffect, useState } from "react";
import type { TinyUIStatus } from "./types";

interface UseServiceWorkerOptions {
  serviceWorkerUrl: string;
  onError?(error: Error): void;
  onStatusChange?(status: TinyUIStatus): void;
}

const initializationErrorMessage = "Tiny UI initialization failed";

function toTinyUIError(error: unknown) {
  return error instanceof Error ? error : new Error(initializationErrorMessage);
}

export function useServiceWorker(options: UseServiceWorkerOptions) {
  const { serviceWorkerUrl, onError, onStatusChange } = options;
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setServiceWorkerReady(false);
    const ensureServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;
      await navigator.serviceWorker.register(serviceWorkerUrl);
      await navigator.serviceWorker.ready;
    };

    (async () => {
      try {
        onStatusChange?.("initializing");
        await ensureServiceWorker();
        if (cancelled) return;
        setServiceWorkerReady(true);
      } catch (error) {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(toTinyUIError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError, serviceWorkerUrl, onStatusChange]);

  return serviceWorkerReady;
}

interface UseCompileOptions {
  autoCompile: boolean;
  serviceWorkerReady: boolean;
  doCompileAndInit(): Promise<void>;
  onError?(error: Error): void;
  onStatusChange?(status: TinyUIStatus): void;
}

export function useCompile(options: UseCompileOptions) {
  const { autoCompile, serviceWorkerReady, doCompileAndInit, onError, onStatusChange } = options;

  useEffect(() => {
    if (!autoCompile || !serviceWorkerReady) return;

    let cancelled = false;

    (async () => {
      try {
        await doCompileAndInit();
      } catch (error) {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(toTinyUIError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoCompile, doCompileAndInit, onError, serviceWorkerReady, onStatusChange]);
}
