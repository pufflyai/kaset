# tiny-plugins

## 1) Browser‑only Host

```ts
export interface HostOptions {
  root: string; // OPFS root for plugins; "" -> "plugins"
  watch?: boolean; // default true; watches <root>/<pluginId>/**
  timeouts?: {
    // ms; non-finite disables timeout
    activate?: number; // default 10_000
    deactivate?: number; // default 5_000
    command?: number; // default 10_000
  };
  notify?: (level: "info" | "warn" | "error", message: string) => void;
}

export function createPluginHost(options: HostOptions): PluginHost;
```

```ts
export interface PluginHost {
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;

  // Inventory
  listPlugins(): PluginMetadata[]; // { id, name?, version? }
  subscribePlugins(cb: (list: PluginMetadata[]) => void): () => void;

  // Per-plugin operations (host → plugin)
  doesPluginExist(pluginId: string): boolean;
  listPluginCommands(pluginId: string): RegisteredCommand[];
  runPluginCommand<T = unknown>(pluginId: string, cmdId: string): (params?: unknown) => Promise<T | void>;
  readPluginSettings<T = unknown>(pluginId: string): Promise<T>;
  writePluginSettings<T = unknown>(pluginId: string, value: T): Promise<void>;
  readPluginManifest(pluginId: string): Promise<Manifest | null>;

  // Global convenience
  listCommands(): Array<RegisteredCommand & { pluginId: string }>;

  // Manifests & UI schemas
  subscribePluginManifest(pluginId: string, cb: (manifest: Manifest | null) => void): () => void;
  subscribeManifests(cb: (update: { pluginId: string; manifest: Manifest | null }) => void): () => void;

  // File‑level watch
  subscribePluginFiles(pluginId: string, cb: (e: { pluginId: string; changes: ChangeRecord[] }) => void): () => void;
}
```

---

## 2) Manifest (strict, host‑validated)

```ts
export interface Manifest {
  id: string;
  name: string;
  version: string; // semver
  api: string; // e.g. "^1.0.0" (host checks major equality OR semver range)
  entry: string; // relative module path to plugin code (e.g., "index.js")

  // Host‑defined UI metadata; strictly validated against HostUISchema (below)
  ui?: HostUIConfig;

  // Commands declared by this plugin (host will register those with matching handlers)
  commands?: CommandDefinition[];

  // Optional: schema purely for settings UI & validation on write
  settingsSchema?: JSONSchema;
}
```

### Host‑defined UI schema (throws on mismatch)

> The host **owns** this shape and validates it (AJV or similar). If `manifest.ui` doesn’t match, the plugin **fails to load**.

```ts
export interface HostUIConfig {
  desktop?: {
    title: string;
    description?: string;
    icon?: string; // host-specific icon key, e.g., "Plug"
    singleton?: boolean; // default false
    defaultSize?: { width: number; height: number };
    minSize?: { width: number; height: number };
    entry: string; // REQUIRED: path to the UI entry (html/js), relative to plugin dir
  };
  // Future surfaces can be added here (e.g., "panel", "commandPalette" etc.)
}
```

**Validation rules (non‑negotiable):**

- If `ui.desktop` exists:
  - `title` is non‑empty string.
  - `entry` is a valid relative path to an existing file at load time.
  - Any `{width,height}` numbers are finite and `minSize` ≤ `defaultSize` if both supplied.
  - Unknown properties → **throw**.

---

## 3) Plugin Module Contract

```ts
export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void; // required
  deactivate?(): Promise<void> | void; // optional
}

export interface PluginModule {
  default?: Plugin; // required default with activate()
  // Command handlers keyed by command id; optional entries are ignored
  commands?: Record<string, CommandHandler>;
}
```

```ts
export interface CommandDefinition {
  id: string; // e.g., "theme.next"
  title: string;
  description?: string;
  category?: string;
  when?: string; // surfaced; host doesn’t interpret
  parameters?: JSONSchema; // host validates params if provided
  timeoutMs?: number; // per-command override (optional)
}

export type CommandHandler = (ctx: PluginContext, params?: unknown) => Promise<unknown | void> | unknown;
```

- If a declared command lacks a matching handler, the host **warns and skips** registration.
- Command return values are forwarded by `host.run(pluginId, ...)`.

---

## 4) PluginContext (lean: host commands + file + network + settings)

> No permissions, no cancel token, no paths object.

```ts
export interface PluginContext {
  id: string;
  manifest: Manifest;
  log: Logger;

  // Host-provided commands (NOT the plugin's own)
  commands: {
    // Show a user-facing notification via host UI
    notify(level: "info" | "warn" | "error", message: string): void;

    // (Reserved for future host commands; keep this minimal for now)
    // e.g., openUrl(url: string): void; track(event: string, props?: Record<string, unknown>): void;
  };

  // Files (scoped to plugin directory; host enforces path normalization)
  fs: {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, contents: Uint8Array | string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    moveFile(from: string, to: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdirp(path: string): Promise<void>;
    readJSON<T = unknown>(path: string): Promise<T>;
    writeJSON(path: string, value: unknown, pretty?: boolean): Promise<void>;
  };

  // Network (browser fetch)
  net: {
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
  };

  // Settings (persisted at <root>/<id>/.settings.json; watcher ignores this file)
  settings: {
    read<T = unknown>(): Promise<T>; // {} if missing/invalid
    write<T = unknown>(value: T): Promise<void>;
  };
}
```

- `ctx.commands` is a **gateway to host services** (e.g., `notify`), not a way to call plugin handlers.
- If you later add more host services, extend `ctx.commands` in one place without touching plugin code.

---

## 5) Command Invocation (host → plugin)

You wanted a curried call; the host supports both forms:

```ts
// Curried (as requested)
host.runCommand("theme-switcher", "theme.next")({ fast: true });

// Or direct sugar
host.run("theme-switcher", "theme.next", { fast: true });
```

Both return `Promise<unknown | void>`.

---

## 6) Loading, Watching & Settings

- **Load flow**
  1. Discover `<root>/<pluginId>/`.
  2. Parse `manifest.json`.
  3. **Enforce `manifest.id === <pluginId>`**; throw if mismatch.
  4. Validate `api` (major equal or semver range containment).
  5. Validate `manifest.ui` against **HostUIConfig schema**; throw on mismatch.
  6. Import `entry` module via dynamic import (blob URL).
  7. Call `plugin.activate(ctx)` (timeout).
  8. Register commands with matching handlers.
  9. Publish `settingsSchema` (if present) to subscribers.

- **Watching**
  - Recursive watcher on `<root>`.
  - Any change under `<root>/<id>/**` triggers **reload** of that plugin **except**:
    - `**/.settings.json`
    - `**/.keep`

  - Debounced per plugin (150 ms).

- **Settings**
  - Stored at `<root>/<pluginId>/.settings.json`.
  - `read()` returns `{}` if missing or invalid.
  - If `settingsSchema` exists, the host validates on `write()` and rejects with a structured error.

---

## 7) Errors

Use a small, consistent taxonomy:

- `E_MANIFEST_PARSE(path, message)`
- `E_MANIFEST_UI_INVALID(pluginId, ajvErrors)`
- `E_API_INCOMPATIBLE(pluginId, pluginApi, hostApi)`
- `E_CMD_NOT_FOUND(pluginId, commandId)`
- `E_CMD_PARAM_INVALID(pluginId, commandId, ajvErrors)`
- `E_IMPORT_FAILED(pluginId, entry, cause)`

All host errors include `pluginId` where applicable.

---

## 8) Examples

### Manifest

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.1.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "ui": {
    "desktop": {
      "title": "Hello World",
      "description": "A simple Hello World plugin.",
      "icon": "Plug",
      "singleton": true,
      "defaultSize": { "width": 840, "height": 620 },
      "minSize": { "width": 420, "height": 320 },
      "entry": "ui/index.html"
    }
  },
  "commands": [
    {
      "id": "theme.next",
      "title": "Theme: Next",
      "parameters": {
        "type": "object",
        "properties": { "fast": { "type": "boolean" } },
        "additionalProperties": false
      }
    }
  ],
  "settingsSchema": {
    "type": "object",
    "properties": {
      "preferred": { "type": "string", "enum": ["light", "dark"] }
    }
  }
}
```

### Plugin module

```js
export default {
  async activate(ctx) {
    ctx.log.info("activated", ctx.id);
  },
  async deactivate() {},
};

export const commands = {
  "theme.next": async (ctx, params) => {
    const settings = await ctx.settings.read();
    const next = settings.preferred === "dark" ? "light" : "dark";
    await ctx.settings.write({ ...settings, preferred: next });

    // Host-provided command
    ctx.commands.notify("info", `Switched theme to ${next}`);
  },
};
```

### Host usage

```ts
import { createPluginHost } from "@pstdio/tiny-plugins";

const host = createPluginHost({
  root: "plugins",
  watch: true,
  notify(level, msg) {
    console[level === "error" ? "error" : "log"]("[plugin]", msg);
  },
});

await host.start();

// Discover & run
if (host.doesPluginExist("theme-switcher")) {
  await host.runCommand("theme-switcher", "theme.next")({ fast: true });
}
```

---

## 9) Minimal JSON Schema for `manifest.ui`

> Host owns and validates this. If you want, embed it and compile once.

```json
{
  "type": "object",
  "properties": {
    "desktop": {
      "type": "object",
      "required": ["title", "entry"],
      "additionalProperties": false,
      "properties": {
        "title": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "icon": { "type": "string" },
        "singleton": { "type": "boolean" },
        "defaultSize": {
          "type": "object",
          "required": ["width", "height"],
          "additionalProperties": false,
          "properties": {
            "width": { "type": "number" },
            "height": { "type": "number" }
          }
        },
        "minSize": {
          "type": "object",
          "required": ["width", "height"],
          "additionalProperties": false,
          "properties": {
            "width": { "type": "number" },
            "height": { "type": "number" }
          }
        },
        "entry": { "type": "string", "minLength": 1 }
      }
    }
  },
  "additionalProperties": false
}
```
