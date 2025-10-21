import { useMemo } from "react";
import { desktopAPI } from "@/services/desktop/desktop-api";
import { host } from "@/services/plugins/host";
import { isHostApiMethod, type HostApi } from "@pstdio/tiny-plugins";
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
      if (isHostApiMethod(method)) {
        const api = await resolveHostApi();
        return api.call(method, params as any);
      }

      const desktopHandler = desktopAPI[method as keyof typeof desktopAPI];
      if (!desktopHandler) {
        throw new Error(`Unhandled Tiny UI action: ${method}`);
      }

      return desktopHandler(params as any);
    };

    return handler;
  }, [pluginId]);
};
