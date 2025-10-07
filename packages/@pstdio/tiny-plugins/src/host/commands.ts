import type { ValidateFunction } from "ajv";
import { commandNotFound, commandParamsInvalid } from "./errors";
import type { CommandDefinition, RegisteredCommand } from "../model/manifest";
import type { CommandHandler, PluginContext } from "../model/plugin";
import { runWithTimeout } from "./timers";

type AjvLike = { compile(schema: unknown): ValidateFunction };

interface CommandEntry {
  pluginId: string;
  id: string;
  definition: CommandDefinition;
  handler: CommandHandler;
  context: PluginContext;
  timeoutMs: number;
  validate?: ValidateFunction;
  abortSignal: AbortSignal;
}

export interface RegisterCommandOptions {
  pluginId: string;
  definitions: CommandDefinition[] | undefined;
  handlers: Record<string, CommandHandler | undefined> | undefined;
  context: PluginContext;
  abortSignal: AbortSignal;
  defaultTimeout: number;
  ajv: AjvLike;
  warn(message: string): void;
}

export class CommandRegistry {
  private readonly entries = new Map<string, CommandEntry[]>();

  register(options: RegisterCommandOptions): RegisteredCommand[] {
    const { pluginId, definitions, handlers, context, abortSignal, defaultTimeout, ajv, warn } = options;

    const registered: CommandEntry[] = [];
    const exposed: RegisteredCommand[] = [];

    for (const definition of definitions ?? []) {
      const handler = handlers?.[definition.id];

      if (typeof handler !== "function") {
        warn(`Command ${definition.id} declared by plugin ${pluginId} has no handler`);
        continue;
      }

      const timeoutMs = Number.isFinite(definition.timeoutMs) && definition.timeoutMs! > 0
        ? definition.timeoutMs!
        : defaultTimeout;

      let validate: ValidateFunction | undefined;
      if (definition.parameters) {
        try {
          validate = ajv.compile(definition.parameters);
        } catch (error) {
          warn(`Failed to compile parameters schema for ${pluginId}:${definition.id}: ${(error as Error).message}`);
        }
      }

      registered.push({
        pluginId,
        id: definition.id,
        definition,
        handler,
        context,
        timeoutMs,
        validate,
        abortSignal,
      });

      exposed.push({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        when: definition.when,
        parameters: definition.parameters,
        timeoutMs: definition.timeoutMs,
      });
    }

    this.entries.set(pluginId, registered);
    return exposed;
  }

  unregister(pluginId: string) {
    this.entries.delete(pluginId);
  }

  list(pluginId: string): RegisteredCommand[] {
    return (this.entries.get(pluginId) ?? []).map((entry) => ({
      id: entry.id,
      title: entry.definition.title,
      description: entry.definition.description,
      category: entry.definition.category,
      when: entry.definition.when,
      parameters: entry.definition.parameters,
      timeoutMs: entry.definition.timeoutMs,
    }));
  }

  listAll(): Array<RegisteredCommand & { pluginId: string }> {
    const out: Array<RegisteredCommand & { pluginId: string }> = [];
    for (const entries of this.entries.values()) {
      for (const entry of entries) {
        out.push({
          pluginId: entry.pluginId,
          id: entry.id,
          title: entry.definition.title,
          description: entry.definition.description,
          category: entry.definition.category,
          when: entry.definition.when,
          parameters: entry.definition.parameters,
          timeoutMs: entry.definition.timeoutMs,
        });
      }
    }
    return out;
  }

  async run(pluginId: string, commandId: string, params: unknown): Promise<unknown | void> {
    const entries = this.entries.get(pluginId) ?? [];
    const entry = entries.find((item) => item.id === commandId);
    if (!entry) {
      throw commandNotFound(pluginId, commandId);
    }

    if (entry.validate && !entry.validate(params)) {
      throw commandParamsInvalid(pluginId, commandId, entry.validate.errors);
    }

    return runWithTimeout(
      () => entry.handler(entry.context, params),
      entry.timeoutMs,
      entry.abortSignal,
    );
  }
}
