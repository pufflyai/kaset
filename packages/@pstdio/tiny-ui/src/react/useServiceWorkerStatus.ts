import { useEffect, useMemo, useState } from "react";
import { getTinyUISetupState, subscribeToTinyUISetup, toTinyUIError } from "../setupTinyUI";
import { TinyUIStatus } from "../types";

interface TinyUIServiceWorkerState {
  serviceWorkerReady: boolean;
  status: TinyUIStatus;
  error: Error | null;
}

export function useServiceWorkerStatus(): TinyUIServiceWorkerState {
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

        if (nextStatus === "service-worker-ready") {
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
        setStatus("service-worker-ready");
        setServiceWorkerReady(true);
        setError(null);
      },
    });

    const snapshot = getTinyUISetupState();

    if (snapshot.error) {
      setStatus("error");
      setServiceWorkerReady(false);
      setError(snapshot.error);
    } else if (snapshot.ready) {
      setStatus("service-worker-ready");
      setServiceWorkerReady(true);
      setError(null);
    } else if (!snapshot.pending) {
      console.warn("[Tiny UI] setupTinyUI has not been called before useTinyUIServiceWorker was used");
      setStatus("idle");
      setServiceWorkerReady(false);
    } else {
      setStatus("initializing");
      setServiceWorkerReady(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  return useMemo<TinyUIServiceWorkerState>(
    () => ({
      serviceWorkerReady,
      status,
      error,
    }),
    [serviceWorkerReady, status, error],
  );
}

function getInitialStatus(snapshot: ReturnType<typeof getTinyUISetupState>): TinyUIStatus {
  if (snapshot.error) return "error";
  if (snapshot.ready) return "service-worker-ready";
  if (snapshot.pending) return "initializing";
  return "idle";
}
