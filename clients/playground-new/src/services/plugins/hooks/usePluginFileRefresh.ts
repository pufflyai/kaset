import { ensurePluginHost } from "@/services/plugins/host";
import debounce from "lodash.debounce";
import { useEffect, useMemo, useState } from "react";

export const usePluginFilesRefresh = (pluginId: string) => {
  const [refreshToken, setRefreshToken] = useState(0);

  const scheduleRefresh = useMemo(
    () =>
      debounce(() => {
        setRefreshToken((value) => value + 1);
      }, 500),
    [setRefreshToken],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    ensurePluginHost().then((host) => {
      if (cancelled) return;

      unsubscribe = host.onPluginChange((changedPluginId, payload) => {
        if (!payload.changes || payload.changes?.length === 0) return;
        if (changedPluginId !== pluginId) return;
        console.log(`######### Plugin ${pluginId} files changed, scheduling refresh...`);
        console.log(payload.paths);
        scheduleRefresh();
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      scheduleRefresh.cancel();
    };
  }, [pluginId, scheduleRefresh]);

  return refreshToken;
};
