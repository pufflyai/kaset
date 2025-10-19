import type { HostApi } from "../core/types";

export type UiOpsRequest = { method: string; params?: Record<string, unknown> };
export type UiOpsHandler = (req: UiOpsRequest) => Promise<unknown>;

export interface CreateUiOpsAdapterOptions {
  hostApi: HostApi;
  forward?: (req: UiOpsRequest) => Promise<unknown>;
}

export function createUiOpsAdapter({ hostApi, forward }: CreateUiOpsAdapterOptions): UiOpsHandler {
  return async ({ method, params }) => {
    if (method.startsWith("actions.")) {
      if (!forward) {
        throw new Error(`No action handler wired for ${method}`);
      }
      return forward({ method, params });
    }
    const table = hostApi as unknown as Record<
      string,
      (args: Record<string, unknown>) => Promise<unknown> | unknown
    >;
    const fn = table[method];
    if (typeof fn !== "function") {
      throw new Error(`Unknown host method: ${method}`);
    }
    return fn(params ?? {});
  };
}
