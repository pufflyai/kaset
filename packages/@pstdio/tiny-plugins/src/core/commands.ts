import type { CommandDefinition, PluginContext } from "./types";

export type CommandHandler = (ctx: PluginContext, params?: unknown) => Promise<unknown | void> | unknown;

export class CommandRegistry {
  private map = new Map<string, Map<string, { def: CommandDefinition; handler: CommandHandler }>>();

  constructor(private readonly defaultTimeoutMs?: number) {}

  register(
    pluginId: string,
    defs: CommandDefinition[] | undefined,
    handlers: Record<string, CommandHandler> | undefined,
  ) {
    const bucket = new Map<string, { def: CommandDefinition; handler: CommandHandler }>();
    for (const def of defs ?? []) {
      const h = handlers?.[def.id];
      if (typeof h !== "function") continue;
      bucket.set(def.id, { def, handler: h });
    }
    this.map.set(pluginId, bucket);
  }

  unregister(pluginId: string) {
    this.map.delete(pluginId);
  }

  list(pluginId: string): CommandDefinition[] {
    return [...(this.map.get(pluginId)?.values() ?? [])].map((e) => e.def);
  }

  listAll(): Array<CommandDefinition & { pluginId: string }> {
    const out: Array<CommandDefinition & { pluginId: string }> = [];
    for (const [pid, bucket] of this.map) {
      for (const { def } of bucket.values()) out.push({ ...def, pluginId: pid });
    }
    return out;
  }

  async run(pluginId: string, commandId: string, ctx: PluginContext, params?: unknown): Promise<unknown | void> {
    const bucket = this.map.get(pluginId);
    const entry = bucket?.get(commandId);
    if (!entry) throw new Error(`Command ${pluginId}:${commandId} not found`);
    const explicit =
      typeof entry.def.timeoutMs === "number" && entry.def.timeoutMs > 0 ? entry.def.timeoutMs : undefined;
    const timeout =
      explicit ?? (this.defaultTimeoutMs && this.defaultTimeoutMs > 0 ? this.defaultTimeoutMs : undefined);
    return timeout ? withTimeout(() => entry.handler(ctx, params), timeout) : entry.handler(ctx, params);
  }
}

async function withTimeout<T>(fn: () => Promise<T> | T, ms: number): Promise<T> {
  const run = Promise.resolve().then(fn);
  if (!ms || ms <= 0) return run;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      run,
      new Promise<T>((_, r) => (timer = setTimeout(() => r(new Error("Operation timed out")), ms))),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
