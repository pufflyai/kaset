import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getTinyUISetupState, subscribeToTinyUISetup, toTinyUIError } from "../setupTinyUI";
import type { TinyUIStatus } from "../types";

interface TinyUIContextValue {
  serviceWorkerReady: boolean;
  status: TinyUIStatus;
  error: Error | null;
}

const TinyUIContext = createContext<TinyUIContextValue | null>(null);

interface TinyUIProviderProps {
  children: React.ReactNode;
}

export function TinyUIProvider(props: TinyUIProviderProps) {
  const { children } = props;

  const initialSnapshot = getTinyUISetupState();
  const initialStatus = getInitialStatus(initialSnapshot);

  const [serviceWorkerReady, setServiceWorkerReady] = useState(initialSnapshot.ready);
  const [status, setStatus] = useState<TinyUIStatus>(initialStatus);
  const [error, setError] = useState<Error | null>(initialSnapshot.error);

  useEffect(() => {
    const unsubscribe = subscribeToTinyUISetup({
      onStatusChange(nextStatus) {
        setStatus(nextStatus);

        if (nextStatus === "initializing") {
          setServiceWorkerReady(false);
        }

        if (nextStatus === "error") {
          setServiceWorkerReady(false);
        }

        if (nextStatus === "ready") {
          setServiceWorkerReady(true);
          setError(null);
        }
      },
      onError(incomingError) {
        const tinyError = toTinyUIError(incomingError);
        setStatus("error");
        setServiceWorkerReady(false);
        setError(tinyError);
      },
      onReady() {
        setStatus("ready");
        setServiceWorkerReady(true);
        setError(null);
      },
    });

    const snapshot = getTinyUISetupState();

    if (snapshot.error) {
      setStatus("error");
      setServiceWorkerReady(false);
      setError(snapshot.error);
      return () => {
        unsubscribe();
      };
    }

    if (snapshot.ready) {
      setStatus("ready");
      setServiceWorkerReady(true);
      setError(null);
      return () => {
        unsubscribe();
      };
    }

    if (!snapshot.pending) {
      console.warn("[Tiny UI] setupTinyUI has not been called before TinyUIProvider mounted");
      setStatus("idle");
      setServiceWorkerReady(false);
      return () => {
        unsubscribe();
      };
    }

    setStatus("initializing");
    setServiceWorkerReady(false);

    return () => {
      unsubscribe();
    };
  }, []);

  const value = useMemo<TinyUIContextValue>(
    () => ({
      serviceWorkerReady,
      status,
      error,
    }),
    [serviceWorkerReady, status, error],
  );

  return <TinyUIContext.Provider value={value}>{children}</TinyUIContext.Provider>;
}

export function useTinyUIServiceWorker() {
  const context = useContext(TinyUIContext);

  if (!context) {
    throw new Error("TinyUIServiceWorker context not found. Wrap your tree with <TinyUIProvider />.");
  }

  return context;
}

function getInitialStatus(snapshot: ReturnType<typeof getTinyUISetupState>): TinyUIStatus {
  if (snapshot.error) return "error";
  if (snapshot.ready) return "ready";
  if (snapshot.pending) return "initializing";
  return "idle";
}
