# Tiny Plugins

**Package:** `@pstdio/tiny-plugins`
**Host API version:** `1.0.0` (see `HOST_API_VERSION`)
**Scope:** Defines the runtime model, wire protocol, and browser wrapper for loading, activating, and invoking Kaset plugins stored in OPFS.

> This specification **describes exactly what the current implementation does**, including limitations and non‑implemented features that are declared in types. Normative key words **MUST**, **SHOULD**, **MAY**, etc., indicate intent; when intent conflicts with code, the code wins and the spec calls that out explicitly.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Runtime Environments](#runtime-environments)
3. [On‑disk Layout (OPFS)](#on-disk-layout-opfs)
4. [Manifests](#manifests)
5. [Plugin Module Contract](#plugin-module-contract)
6. [Plugin Context API](#plugin-context-api)
7. [Command Registration & Invocation](#command-registration--invocation)
8. [Activation Events](#activation-events)
9. [Settings Storage](#settings-storage)
10. [Networking](#networking)
11. [Core Host API (`createPluginHost`)](#core-host-api-createpluginhost)
12. [Browser Wrapper (`createBrowserPluginHost`)](#browser-wrapper-createbrowserpluginhost)
13. [File Watching & Hot Reload](#file-watching--hot-reload)
14. [Timeouts & Cancellation](#timeouts--cancellation)
15. [Notifications & UI Adapter](#notifications--ui-adapter)
16. [Tiny‑AI Tasks Adapter](#tiny-ai-tasks-adapter)
17. [Errors & Edge Cases](#errors--edge-cases)
18. [Security Considerations](#security-considerations)
19. [Versioning & Compatibility](#versioning--compatibility)
20. [Examples](#examples)
21. [Not Implemented / Reserved](#not-implemented--reserved)

---

## Architecture Overview

The host loads plugins from a **plugins root** in OPFS, validates basic manifest fields, dynamically imports each plugin’s `entry` module, calls `activate`, registers command handlers declared in the manifest, and exposes a permission‑scoped\* execution context (see [Security](#security-considerations)).

Two layers are provided:

- **Core Host** (`createPluginHost`) – environment‑agnostic logic for loading/unloading plugins, invoking commands, broadcasting events, and persisting settings.
- **Browser Wrapper** (`createBrowserPluginHost`) – browser‑only façade that normalizes OPFS paths, manages subscriptions and UI‑friendly caches, and exposes higher‑level operations.

---

## Runtime Environments

- **Core Host** can run wherever `@pstdio/opfs-utils` is available.
- **Browser Wrapper** **MUST** run in a browser; it checks `typeof window !== "undefined"` and will throw if called outside a browser.

---

## On‑disk Layout (OPFS)

```
<pluginsRoot>/              (default: "plugins")
  <plugin-id>/
    manifest.json           (required)
    <entry module>          (e.g., index.js)
state/public/plugins/
  <plugin-id>.json          (settings file per plugin, auto‑created on write)
```

The wrapper normalizes configured roots by trimming slashes; an empty or all‑slashes string normalizes to `"plugins"`.

---

## Manifests

**Type:** `src/model/manifest.ts`

```ts
export interface Manifest {
  id: string; // SHOULD equal directory name; mismatch is only warned
  name: string;
  version: string; // plugin's own semver
  api: string; // required; MUST be compatible with host major (see below)
  entry: string; // relative to plugin directory
  activation?: ActivationEvent[];
  permissions?: { fs?: { read?: string[]; write?: string[] }; net?: string[] };
  commands?: CommandDefinition[];
  ui?: Record<string, unknown>;
  settingsSchema?: JSONSchema; // surfaced to UI at load/unload
}
```

**API compatibility:**
A manifest is considered compatible **iff** the first integer in `api` (optionally prefixed by `^`) equals the host major (`1` today). Any other format or major mismatch rejects the plugin at load.

Examples considered compatible with host `1.0.0`: `"^1.0.0"`, `"1"`, `"^1"`.

> **Note:** Only this major‑equality check is performed. No additional schema validation is performed by the core host.

---

## Plugin Module Contract

**Type:** `src/model/plugin.ts`

A plugin module **MUST** provide a default export with an `activate` function:

```ts
export interface Plugin {
  activate(ctx: PluginContext): Promise<void> | void; // required
  deactivate?(): Promise<void> | void; // optional
}

export interface PluginModule {
  default?: Plugin;
  commands?: Record<string, CommandHandler>; // handlers keyed by command id
}
```

- If `default.activate` is missing, loading fails.
- If `default.deactivate` exists, it is called during unload with a timeout (see [Timeouts](#timeouts--cancellation)).

---

## Plugin Context API

**Type:** `src/host/context.ts`

```ts
export interface PluginContext {
  id: string; // manifest.id
  manifest: Manifest; // parsed manifest
  log: Logger; // console.* with plugin prefix
  fs: FSApi; // OPFS access (no runtime permission checks)
  settings: SettingsApi; // persisted under state/public/plugins/<id>.json
  ui: UIHostApi; // notify -> UI adapter
  commands: CommandsApi; // invoke() OWN plugin's commands only
  events: EventsApi; // in-process event hub per plugin
  net?: { fetch: (url: string, init?: RequestInit) => Promise<Response> }; // see Networking
  cancelToken: AbortSignal; // aborted on unload/reload
  disposables: Array<Disposable | (() => void | Promise<void>)>; // disposed on unload
}
```

### FS API

- `readFile(path)`, `writeFile(path, contents)`, `deleteFile(path)`, `moveFile(from, to)`
- **No path sandboxing is enforced by the host.** See [Security](#security-considerations).

### Settings API

- `read<T>(): Promise<T>` returns `{}` if the settings file is missing.
- `write<T>(value: T): Promise<void>` writes pretty‑printed JSON.

**Storage path:** `state/public/plugins/<pluginId>.json`.

### Commands API

- `invoke(commandId, params?)` finds and runs a command **within the same plugin**.
  - Cross‑plugin invocation is **not** supported by the implementation.

### Events API

In‑memory event hub per plugin:

- `on(event, listener) -> Disposable`
- `off(event, listener)`
- `emit(event, payload?)`

> The host also provides a top‑level `emit(name, payload?)` that **broadcasts** to all plugins’ event hubs (see [Core Host API](#core-host-api-createpluginhost)).

### `net?.fetch`

- Present **iff** the host was created with a `netFetch` function.
  - In the **browser wrapper**, `net.fetch` is **always present** (defaults to `window.fetch` unless overridden).
  - In the **core host**, `net.fetch` is **undefined** unless provided in `HostConfig.netFetch`.

---

## Command Registration & Invocation

**Declaration:** via `manifest.commands: CommandDefinition[]`.
**Implementation:** module export `commands?: Record<string, CommandHandler>`.

At load time:

- For each declared command, the host looks up `module.commands[definition.id]`.
- If a handler is missing, the host logs a warning and **does not** register that command.
- For each registered command the host maintains a `RegisteredCommand` object:

```ts
export interface RegisteredCommand {
  pluginId: string; // manifest.id
  id: string; // CommandDefinition.id
  title: string; // CommandDefinition.title
  description?: string;
  category?: string;
  when?: string; // not interpreted by the host
  parameters?: JSONSchema; // unvalidated, surfaced to UI
  run: (params?: unknown) => Promise<void>; // executes handler with timeout
}
```

**Parameters:** The host does **not** validate parameters against `parameters` (JSON Schema). It passes `params` verbatim to the handler.

**Invocation:** By plugin ID and command ID: `host.invokeCommand(pluginId, commandId, params?)`. If not found, throws `Error("Command not found: <pluginId>:<commandId>")`.

---

## Activation Events

**Declared in manifest** via `activation?: ActivationEvent[]` with shapes:

- `{ type: "onStartup" }`
- `{ type: "onCommand", id: string }`
- `{ type: "onFSChange", glob: string }`
- `{ type: "onCron", expr: string }`
- `{ type: "onEvent", name: string }`

**Implemented behavior:**

- `onFSChange` – **Implemented.**
  The host installs a global OPFS watcher (root path `""`, recursive) and, for each change, matches the absolute path (e.g., `/foo/bar.txt`) against the plugin’s `glob` via `picomatch/posix`. On match, the host emits `events.emit("fs:change", { glob, change })` into that plugin’s event hub.

- `onCron` – **Not implemented.** A warning is logged:
  `"Plugin <id> requested cron activation (<expr>) but cron is not implemented yet."`

- `onStartup`, `onCommand`, `onEvent` – **No special wiring** by the host. Plugins may observe `ctx.events` and respond as they wish.

> Regardless of `activation`, the host **always** calls `plugin.activate(ctx)` during load.

---

## Settings Storage

- Per plugin settings are persisted at `state/public/plugins/<pluginId>.json`.
- The core host **surfaces** `manifest.settingsSchema` to the UI adapter when a plugin loads, and **clears** it on unload.
- Plugins **cannot** update the settings schema dynamically via code in the current implementation (no API to push schema updates beyond the manifest).

---

## Networking

- If a `netFetch` is provided to the host, `ctx.net.fetch` is available to plugins.
- The browser wrapper always passes `netFetch = (url, init) => fetch(url, init)` unless overridden, so plugins **will** have `ctx.net.fetch` in browser usage.
- **No URL allow‑list/deny‑list enforcement is performed** by the host against `permissions.net`.

---

## Core Host API (`createPluginHost`)

**Factory:** `createPluginHost(config?: HostConfig): PluginHost`

```ts
export interface HostConfig {
  pluginsRoot?: string; // default "plugins"; leading slashes trimmed
  watchPlugins?: boolean; // default true
  ui?: UIAdapter; // see Notifications
  netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  timeouts?: { command?: number; activate?: number; deactivate?: number }; // ms
}

export interface PluginHost {
  loadAll(): Promise<void>; // load all plugins under pluginsRoot
  unloadAll(): Promise<void>; // unload all, stop watcher
  reloadPlugin(id: string): Promise<void>; // unload + load
  invokeCommand(pluginId: string, commandId: string, params?: unknown): Promise<void>;
  listCommands(): RegisteredCommand[]; // snapshot (by reference; do not mutate)
  emit(name: string, payload?: unknown): void; // broadcast to all plugins' event hubs
  getSettingsSchema(pluginId: string): JSONSchema | undefined; // from manifest
  readSettings<T>(pluginId: string): Promise<T>; // {} if missing
  writeSettings<T>(pluginId: string, value: T): Promise<void>;
}
```

### Behavior

- **Loading:**
  - Lists immediate subdirectories of `pluginsRoot` (`ls(..., { maxDepth: 1, kinds: ["directory"] })`).
  - For each directory:
    - Reads and parses `manifest.json` (rejects on parse error).
    - Validates `api` compatibility (major equal); otherwise throws.
    - Reads plugin `entry`, imports via `Blob` + `import(objectURL)`.
    - Calls `plugin.activate(ctx)` with a timeout (default 10s).
    - Registers commands that have matching handlers (`module.commands[commandId]`).
    - If `manifest.settingsSchema` is present, calls `ui.onSettingsSchema(pluginId, schema)`.
    - Applies activation (`onFSChange` only).

- **Watching:**
  If `watchPlugins !== false`, installs a recursive watcher on `pluginsRoot`. Any change groups by first path segment (plugin id) and triggers `reloadPlugin(id)`.

- **Unloading:**
  - Aborts the per‑plugin abort controller.
  - Removes registered commands.
  - Disposes registered cleanups and any `ctx.disposables`.
  - Calls `plugin.deactivate()` with a timeout (default 5s).
  - Revokes the imported module `objectURL`.
  - Emits `ctx.events.emit("deactivated")`.
  - Clears settings schema via `ui.onSettingsSchema(pluginId, undefined)`.

---

## Browser Wrapper (`createBrowserPluginHost`)

**Factory:** `createBrowserPluginHost(options: BrowserHostOptions): BrowserPluginHost`

```ts
export interface BrowserHostOptions {
  root: string; // normalized; "" -> "plugins"
  notify?: (level: NotificationLevel, message: string) => void; // convenience
  host?: Omit<HostConfig, "pluginsRoot" | "ui" | "netFetch" | "watchPlugins"> & {
    netFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  };
  watch?: boolean; // default true
  onPluginEvent?: (pluginId: string, event: string, payload: unknown) => void; // reserved; not invoked
}

export interface BrowserPluginHost {
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;

  // Commands
  listCommands(): RegisteredCommand[];
  subscribeCommands(listener: (commands: RegisteredCommand[]) => void): () => void;
  runCommand(pluginId: string, commandId: string, params?: unknown): Promise<void>;

  // Settings schema & values
  subscribeSettings(listener: (pluginId: string, schema?: JSONSchema) => void): () => void;
  readSettings<T = unknown>(pluginId: string): Promise<T>;
  writeSettings<T = unknown>(pluginId: string, value: T): Promise<void>;

  // Plugin metadata & manifests
  listPlugins(): PluginMetadata[]; // { id, name?, version? }
  subscribePlugins(listener: (plugins: PluginMetadata[]) => void): () => void;
  getPluginDisplayName(pluginId: string): string;
  readManifest(pluginId: string): Promise<unknown | null>;
  subscribeManifest(pluginId: string, listener: (manifest: unknown | null) => void): () => void;
  subscribeManifests(listener: (update: { pluginId: string; manifest: unknown | null }) => void): () => void;

  // File‑level changes under a specific plugin directory
  subscribePluginFiles(
    pluginId: string,
    listener: (e: { pluginId: string; changes: ChangeRecord[] }) => void,
  ): () => void;

  // Debug
  getRoot(): string;
}
```

### Behavior

- `start()`
  - Ensures the root directory exists by writing and then trying to delete a `.keep` file.
  - Creates an underlying core host with:
    - `pluginsRoot = normalize(root)`
    - `watchPlugins = options.watch ?? true`
    - `netFetch = options.host?.netFetch ?? fetch`
    - `ui` implementation that:
      - pushes command snapshots on change,
      - forwards `notify`,
      - publishes the (static) `settingsSchema` from manifest,
      - forwards `onPluginEvent` (**not invoked by core host; see [Not Implemented](#not-implemented--reserved)**).

  - Calls `host.loadAll()`.
  - Reads manifests and metadata for all plugin directories.
  - Starts a root watcher to refresh inventory (150 ms debounce).
  - Starts any per‑plugin file watchers that already have subscribers.
  - Sets `ready = true`.

- `stop()`
  - Calls `host.unloadAll()`.
  - Disposes root and per‑plugin file watchers.
  - Clears in‑memory caches (`commands`, `schemas`, `metadata`, `manifests`) and notifies subscribers:
    - `subscribeCommands` -> `[]`
    - `subscribePlugins` -> `[]`
    - `subscribeSettings` -> `(pluginId, undefined)` for each previously known schema
    - `subscribeManifest(s)` -> `{ pluginId, manifest: null }` for each known manifest

- **Subscriptions** call listeners immediately with the current snapshot when registered.

- `runCommand`, `readSettings`, `writeSettings` **auto‑start** the host if needed.

- `readManifest(pluginId)`
  - Returns cached value if present (including `null` for missing).
  - Otherwise reads `manifest.json` directly from OPFS and updates caches/metadata (without requiring `start()`).

- `subscribePluginFiles(pluginId, listener)`
  - Creates a dedicated watcher for `<root>/<pluginId>`; forwards raw `ChangeRecord[]`.
  - If no listeners remain, disposes that watcher and deletes its record.

- **Metadata derivation** from manifest: `{ id: manifest.id ?? pluginId, name?: manifest.name, version?: manifest.version }`.

---

## File Watching & Hot Reload

- **Core host** installs a recursive watcher on the plugins root. Any change under `pluginsRoot/<id>/...` triggers `reloadPlugin(<id>)`.
- **Browser wrapper** installs:
  - A root watcher that refreshes the _inventory_ and cached manifests (with 150 ms debounce).
  - Optional per‑plugin directory watchers for subscribers of `subscribePluginFiles`.

When a `manifest.json` is touched under a watched plugin directory, the browser wrapper re‑reads and republishes that manifest to subscribers (it does **not** itself reload the plugin; the core host’s root watcher handles reload).

---

## Timeouts & Cancellation

Default timeouts (ms):

```ts
command = 10_000;
activate = 10_000;
deactivate = 5_000;
```

- Timeouts are applied by `runWithTimeout`.
- If `AbortSignal` is already aborted, operations reject with an `AbortError` (DOMException where available, else `Error` with `name = "AbortError"`).
- Non‑finite or ≤0 timeouts effectively disable the timeout for that call.
- On unload/reload, the plugin’s `AbortController` is aborted; any in‑flight commands/activate calls will reject accordingly.

---

## Notifications & UI Adapter

**Type:** `src/host/context.ts` → `UIAdapter`

```ts
export interface UIAdapter {
  onCommandsChanged(commands: RegisteredCommand[]): void; // required
  notify?(level: "info" | "warn" | "error", message: string): void;
  onSettingsSchema?(pluginId: string, schema?: Record<string, unknown>): void;
  onPluginEvent?(pluginId: string, event: string, payload: unknown): void; // not used by core host
}
```

- The core host **always** calls `onCommandsChanged` after any registration/removal.
- The core host **calls** `onSettingsSchema(pluginId, schema)` exactly at:
  - plugin load (with `manifest.settingsSchema` if present),
  - plugin unload (with `undefined`).

- `notify` is surfaced to plugins via `ctx.ui.notify` and called by the host for host‑level messages.
- `onPluginEvent` exists in the type but is **not invoked** by the core host in this implementation.

---

## Tiny‑AI Tasks Adapter

**File:** `src/browser/adapters/tiny-ai-tasks.ts`

`createToolsForCommands(commands, runner) => Tool[]` adapts `RegisteredCommand[]` to `@pstdio/tiny-ai-tasks` tools.

- **Tool names** are sanitized: `plugin_<pluginId>_<commandId>` with `[^a-zA-Z0-9_-]` replaced by `_`.
- **Definition.description** is chosen as `cmd.description?.trim() || cmd.title || "${pluginId}:${id}"`.
- **Definition.parameters** is `cmd.parameters` if present, else `{ type: "object", properties: {}, additionalProperties: false }`.
- **Run behavior:** calls `runner(pluginId, commandId, params)`; returns:

  ```json
  {
    "data": {
      "success": true,
      "pluginId": "...",
      "commandId": "...",
      "title": "...",
      "description": "...",
      "parameters": {
        /* the incoming params */
      }
    },
    "messages": [
      {
        "role": "tool",
        "tool_call_id": "<id or empty>",
        "content": "<same payload as JSON string>"
      }
    ]
  }
  ```

- The adapter does **not** validate parameter shapes against the schema.

---

## Errors & Edge Cases

- **Manifest parse failure:** `Failed to parse JSON from <path>: <message>` (throws).
- **API incompatibility:** `Plugin <id> targets API <range>, which is incompatible with host <HOST_API_VERSION>` (throws).
- **Missing command at invocation:** throws `Error("Command not found: <pluginId>:<commandId>")`.
- **OPFS missing directory:** core host treats missing `pluginsRoot` as empty set; browser wrapper auto‑creates the root on `start()` by touching `.keep`.
- **File system errors:** Code recognizes both DOM `NotFoundError` and a custom `{ code: 404 }` shape when reading listings/manifests in the browser wrapper; other errors are logged via `console.warn` and treated as empty results where appropriate.
- **Module import:** dynamic import via `Blob` + `ObjectURL`. Import errors revoke the URL and rethrow.

---

## Security Considerations

> ⚠️ **Important:** While `permissions` are declared in the manifest, **the current implementation does not enforce them**.

- **FS access**: `ctx.fs` exposes unconstrained read/write/move/delete via `@pstdio/opfs-utils`. No glob‑based allow/deny logic is applied.
- **Network**: If `netFetch` is provided, plugins can fetch arbitrary URLs; no allow‑list is enforced even if `permissions.net` exists.
- **Dynamic import**: Plugins are imported as code blobs; treat plugin code as untrusted and rely on the browser’s execution context (e.g., COOP/COEP) and OPFS scoping where applicable.

Consumers embedding the host **SHOULD** enforce permissions at the adapter layer (e.g., wrap `fs` and `netFetch`) until host‑level enforcement is introduced.

---

## Versioning & Compatibility

- **Host API**: `HOST_API_VERSION = "1.0.0"`.
- **Compatibility check**: manifest `api` must have the same **major** as the host (see [Manifests](#manifests)).
- **Semantics stability**: Command registration, settings persistence path, and event names documented here are considered stable for the `1.x` line.

---

## Examples

### Minimal Manifest

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.1.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "commands": [
    {
      "id": "theme.next",
      "title": "Theme: Next",
      "category": "Appearance",
      "parameters": {
        "type": "object",
        "properties": {},
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

### Minimal Plugin Module (`index.js`)

```js
export default {
  async activate(ctx) {
    ctx.log.info("activated", ctx.id);
    ctx.events.on("fs:change", ({ glob, change }) => ctx.log.info("fs:change", glob, change));
  },
  async deactivate() {
    // cleanup if needed
  },
};

export const commands = {
  "theme.next": async (ctx, params) => {
    const settings = await ctx.settings.read();
    // mutate settings and persist
    await ctx.settings.write({ ...settings, preferred: "dark" });
    ctx.ui.notify?.("info", "Switched theme");
  },
};
```

### Browser Host Usage

```ts
import { createBrowserPluginHost } from "@pstdio/kaset-plugin-host";

const host = createBrowserPluginHost({
  root: "plugins",
  notify(level, message) {
    console[level === "error" ? "error" : "log"]("[plugin]", message);
  },
  watch: true,
  host: { timeouts: { command: 15000 } },
});

await host.start();
const commands = host.listCommands();
await host.runCommand("theme-switcher", "theme.next");
```

---

## Not Implemented / Reserved

- `activation: onCron` – not implemented; logs a warning.
- `activation: onStartup`, `onCommand`, `onEvent` – declared but no host‑side wiring; plugins must self‑manage via `ctx.events`.
- `UIAdapter.onPluginEvent` – reserved but never called by the core host.
- **Permissions** (`permissions.fs`, `permissions.net`) – **declared only**; not enforced.
- **Parameter validation** against `CommandDefinition.parameters` – not performed.
- `when` expressions on commands – surfaced but not interpreted by the host.
