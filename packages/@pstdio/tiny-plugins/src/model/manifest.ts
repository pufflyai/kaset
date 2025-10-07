export type JSONSchema = Record<string, unknown>;

export interface HostUIConfig {
  desktop?: {
    title: string;
    description?: string;
    icon?: string;
    singleton?: boolean;
    defaultSize?: { width: number; height: number };
    minSize?: { width: number; height: number };
    entry: string;
  };
}

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  category?: string;
  when?: string;
  parameters?: JSONSchema;
  timeoutMs?: number;
}

export interface Manifest {
  id: string;
  name: string;
  version: string;
  api: string;
  entry: string;
  ui?: HostUIConfig;
  commands?: CommandDefinition[];
  settingsSchema?: JSONSchema;
}

export interface RegisteredCommand extends CommandDefinition {
  timeoutMs?: number;
}

export interface PluginMetadata {
  id: string;
  name?: string;
  version?: string;
}
