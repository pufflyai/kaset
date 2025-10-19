import { useEffect, useState } from "react";
import {
  ensurePluginHost,
  getMergedPluginDependencies,
  isPluginHostReady,
  subscribeToPluginDependencies,
} from "@/services/plugins/host";
import { setLockfile } from "@pstdio/tiny-ui";

const normalizeLockfile = (dependencies: Record<string, string>) => {
  const entries = Object.entries(dependencies);
  if (entries.length === 0) return null;
  return entries.reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

export const usePluginDependenciesReady = () => {
  const [ready, setReady] = useState(false);
  const [lockfile, setLockfileState] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let disposed = false;
    let hostReady = isPluginHostReady();
    let latestLockfile = hostReady ? normalizeLockfile(getMergedPluginDependencies()) : null;
    let hasSnapshot = hostReady;

    const commitLockfile = () => {
      if (disposed || !hasSnapshot) return;
      setLockfile(latestLockfile);
      setLockfileState(latestLockfile);
      setReady(true);
    };

    if (hostReady) {
      commitLockfile();
    }

    const unsubscribe = subscribeToPluginDependencies((dependencies) => {
      if (disposed) return;
      hasSnapshot = true;
      latestLockfile = normalizeLockfile(dependencies);

      if (hostReady) {
        commitLockfile();
      }
    });

    ensurePluginHost()
      .then(() => {
        if (disposed) return;
        hostReady = true;
        if (!ready) {
          commitLockfile();
        }
      })
      .catch((error) => {
        if (disposed) return;
        console.warn("[usePluginDependenciesReady] Failed to initialize plugin host", error);
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  return { ready, lockfile };
};
