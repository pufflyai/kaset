export type Glob = string;

export interface Permissions {
  fs?: { read?: Glob[]; write?: Glob[] };
  net?: string[];
}

export type ActivationEvent =
  | { type: "onStartup" }
  | { type: "onCommand"; id: string }
  | { type: "onFSChange"; glob: Glob }
  | { type: "onCron"; expr: string }
  | { type: "onEvent"; name: string };

export interface UICommandDefinition {
  id: string;
  title: string;
  category?: string;
  when?: string;
}

export interface UICommands {
  commands?: UICommandDefinition[];
}

export type JSONSchema = Record<string, unknown>;

export interface Manifest {
  id: string;
  name: string;
  version: string;
  api: string;
  entry: string;
  activation?: ActivationEvent[];
  permissions?: Permissions;
  ui?: UICommands;
  settingsSchema?: JSONSchema;
}
