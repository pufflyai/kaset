type MethodTable = Record<string, (params?: any) => Promise<any> | any>;

export function createActionApi(host: { createHostApiFor(pluginId: string): MethodTable }, pluginId: string) {
  const api = host.createHostApiFor(pluginId);
  return function handleActionCall(method: string, params: any) {
    const fn = api[method];
    if (typeof fn !== "function") throw new Error(`Unknown method: ${method}`);
    return fn(params ?? {});
  };
}
