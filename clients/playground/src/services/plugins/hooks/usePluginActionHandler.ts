import { desktopAPI } from "@/services/desktop/desktop-api";
import { host } from "@/services/plugins/host";
import { isHostApiMethod, markTransferables, type HostApi } from "@pstdio/tiny-plugins";
import { useMemo } from "react";
import type { TinyUIActionHandler } from "@pstdio/tiny-ui";

export const usePluginActionHandler = (pluginId: string): TinyUIActionHandler => {
  return useMemo(() => {
    let hostApiPromise: Promise<HostApi> | null = null;

    const resolveHostApi = async () => {
      if (!hostApiPromise) {
        hostApiPromise = host.createHostApi(pluginId).catch((error) => {
          hostApiPromise = null;
          throw error;
        });
      }
      return hostApiPromise;
    };

    const handler: TinyUIActionHandler = async (method, params) => {
      let result: unknown;

      if (isHostApiMethod(method)) {
        const api = await resolveHostApi();
        result = await api.call(method, params as any);
      } else {
        const desktopHandler = desktopAPI[method as keyof typeof desktopAPI];
        if (!desktopHandler) {
          throw new Error(`Unhandled Tiny UI action: ${method}`);
        }

        result = await desktopHandler(params as any);
      }

      return markTransferables(result);
    };

    return handler;
  }, [pluginId]);
};
