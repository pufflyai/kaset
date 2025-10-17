import { useCallback, useEffect, useRef } from "react";
import { type CompileResult } from "@pstdio/tiny-ui-bundler";
import { createTinyHost } from "../comms/host";
import { TinyUIStatus } from "./types";

type HostInstance = Awaited<ReturnType<typeof createTinyHost>>;

interface UseCommsOptions {
  id: string;
  onReady?: (r: CompileResult) => void;
  onError?: (e: Error) => void;
  resultRef: React.RefObject<CompileResult | null>;
  onStatusChange?(status: TinyUIStatus): void;
}

interface UseCommsResult {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  getHost(): Promise<HostInstance>;
}

export function useComms(options: UseCommsOptions): UseCommsResult {
  const { id, onReady, onError, resultRef, onStatusChange } = options;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HostInstance | null>(null);
  const hostPromiseRef = useRef<Promise<HostInstance> | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    const hostPromise = createTinyHost(iframe, id);
    hostPromiseRef.current = hostPromise;

    hostPromise
      .then((host) => {
        if (cancelled) {
          host.disconnect();
          return;
        }

        host.onReady(() => {
          onStatusChange?.("ready");
          if (resultRef.current) onReady?.(resultRef.current);
        });

        host.onError(({ message, stack }) => {
          const err = new Error(message);
          err.stack = stack;
          onStatusChange?.("error");
          onError?.(err);
        });

        hostRef.current = host;
      })
      .catch((err) => {
        if (cancelled) return;
        onStatusChange?.("error");
        onError?.(err instanceof Error ? err : new Error("Tiny UI host failed to initialize"));
      });

    return () => {
      cancelled = true;
      hostPromiseRef.current = null;
      if (hostRef.current) {
        hostRef.current.disconnect();
        hostRef.current = null;
      }
    };
  }, [id, onError, onReady, resultRef, onStatusChange]);

  const getHost = useCallback(async () => {
    if (hostRef.current) return hostRef.current;
    if (hostPromiseRef.current) return hostPromiseRef.current;
    throw new Error("Tiny UI host not ready");
  }, []);

  return { iframeRef, getHost };
}
