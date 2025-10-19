import { host } from "@/services/plugins/host";
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

    host.ensureHost().then((instance) => {
      if (cancelled) return;

      unsubscribe = instance.onPluginChange((changedPluginId, payload) => {
        if (!payload.changes || payload.changes?.length === 0) return;
        if (changedPluginId !== pluginId) return;
        // TODO: for some reason this triggers on first render
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
