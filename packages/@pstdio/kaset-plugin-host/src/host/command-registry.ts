import type { CommandDefinition } from "../model/manifest";
import type { RegisteredCommand, UIAdapter } from "./ui-adapter";

export class CommandRegistry {
  private readonly commands: RegisteredCommand[] = [];
  private readonly byPlugin = new Map<string, Map<string, RegisteredCommand>>();

  constructor(private readonly adapter: UIAdapter) {}

  register(pluginId: string, definition: CommandDefinition, run: () => Promise<void>): RegisteredCommand {
    if (!definition.id) {
      throw new Error("Command definition is missing an id");
    }
    const existing = this.byPlugin.get(pluginId)?.get(definition.id);
    if (existing) {
      throw new Error(`Command already registered: ${pluginId}:${definition.id}`);
    }
    const command: RegisteredCommand = {
      pluginId,
      ...definition,
      run,
    };
    if (!this.byPlugin.has(pluginId)) {
      this.byPlugin.set(pluginId, new Map());
    }
    this.byPlugin.get(pluginId)!.set(definition.id, command);
    this.commands.push(command);
    this.adapter.onCommandsChanged(this.list());
    return command;
  }

  unregister(pluginId: string, commandId: string): void {
    const commandsForPlugin = this.byPlugin.get(pluginId);
    if (!commandsForPlugin) return;
    const command = commandsForPlugin.get(commandId);
    if (!command) return;
    commandsForPlugin.delete(commandId);
    const index = this.commands.indexOf(command);
    if (index >= 0) {
      this.commands.splice(index, 1);
    }
    if (commandsForPlugin.size === 0) {
      this.byPlugin.delete(pluginId);
    }
    this.adapter.onCommandsChanged(this.list());
  }

  removeAll(pluginId: string): void {
    const commandsForPlugin = this.byPlugin.get(pluginId);
    if (!commandsForPlugin) return;
    for (const commandId of commandsForPlugin.keys()) {
      this.unregister(pluginId, commandId);
    }
  }

  find(pluginId: string, commandId: string): RegisteredCommand | undefined {
    return this.byPlugin.get(pluginId)?.get(commandId);
  }

  list(): RegisteredCommand[] {
    return [...this.commands];
  }
}
