---
title: "@pstdio/tiny-plugins"
---

# @pstdio/tiny-plugins

`@pstdio/tiny-plugins` is the next generation of the Kaset plugin runtime. It loads editable plugins from the Origin Private File System (OPFS), validates their manifests against the host API version, and exposes a minimal command-and-settings surface to your application.

Use it to deliver in-browser automations, command palettes, and custom UI entry points without shipping a new build.

## Highlights

- Enumerate and watch OPFS-backed plugins with a single host instance
- Enforce manifest compatibility via `HOST_API_VERSION` and JSON Schema validation
- Execute plugin commands with parameter validation and per-command timeouts
- Persist plugin-scoped settings to OPFS with optional schema validation
- Surface file change notifications and manifest updates to your UI
- Adapt plugin commands into Tiny AI Tasks tools with `createToolsForCommands`

## Installation

```bash
npm i @pstdio/tiny-plugins
```

## Host Lifecycle

```ts
import { createHost } from "@pstdio/tiny-plugins";

const host = createHost({
  root: "plugins",
  dataRoot: "plugin-data",
  watch: true,
  notify(level, message) {
    console[level === "error" ? "error" : "info"](`[plugin] ${message}`);
  },
});

await host.start();

const offPluginChange = host.onPluginChange((pluginId, { paths, manifest }) => {
  renderPluginPalette(host.getMetadata());
  console.debug(`[plugin] ${pluginId} changed`, paths, manifest?.version);
});

const offDependencies = host.onDependencyChange(({ deps }) => {
  refreshDependencyInspector(deps);
});

const commands = host.listCommands();
console.info(
  "registered commands",
  commands.map((c) => `${c.pluginId}:${c.id}`),
);

await host.runCommand("theme-switcher", "theme.next", { skipAnimation: true });

const settings = await host.readSettings<{ current?: string }>("theme-switcher");
await host.updateSettings("theme-switcher", { ...settings, current: "dark" });

offPluginChange();
offDependencies();
await host.stop();
```

`createHost` automatically watches the plugin root (default `plugins`) when `watch` is enabled. It preloads every discovered plugin on `start()`, keeps manifests and commands in sync, and cleans up timers, watchers, and object URLs when `stop()` is called.

## API Surface

- `start()` / `stop()` – control the lifecycle of the host and all loaded plugins.
- `onPluginChange(cb)` – observe manifest snapshots, changed file paths, and full file listings per plugin.
- `onDependencyChange(cb)` – receive the merged dependency map across all loaded plugins.
- `onSettingsChange(cb)` – react to persisted settings updates triggered by plugins or the host.
- `onStatus(cb)` / `onError(cb)` – surface host notifications to your UI.
- `getMetadata()` – retrieve the current plugin metadata snapshot.
- `getPluginDependencies()` – inspect the merged dependency map.
- `listCommands()` – enumerate all registered commands (`pluginId`, `id`, `title`, ...).
- `runCommand(pluginId, commandId, params?)` – execute a plugin command directly.
- `readSettings(pluginId)` / `updateSettings(pluginId, value)` – persist JSON settings under `/plugin_data/<id>/.settings.json`; the first `readSettings` call seeds manifest `settingsSchema` defaults when available.
- `createHostApiFor(pluginId)` – expose the `api.call(method, params?)` bridge (fs/logs/settings) for Tiny UI surfaces.

All subscriptions return an unsubscribe function for teardown.

## Plugin Layout

```
/plugins/
  <plugin-id>/
    manifest.json
    index.js

/plugin_data/
  <plugin-id>/
    .settings.json          # auto-created by the host
```

Hosts expect the plugin directory name to match the manifest `id`. When running in the browser, every file lives inside OPFS.

## Manifest Reference

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.1.0",
  "api": "v1",
  "entry": "index.js",
  "commands": [
    {
      "id": "theme.next",
      "title": "Theme: Next",
      "category": "Appearance",
      "description": "Advance to the next accent theme.",
      "parameters": {
        "type": "object",
        "properties": {
          "skipAnimation": { "type": "boolean" }
        },
        "additionalProperties": false
      },
      "timeoutMs": 5000
    }
  ],
  "dependencies": {
    "theme-utils": "/deps/theme-utils.js"
  },
  "surfaces": {
    "palette": {
      "icon": "theme",
      "label": "Switch theme"
    }
  },
  "settingsSchema": {
    "type": "object",
    "properties": {
      "current": { "type": "string", "default": "light" },
      "themes": {
        "type": "array",
        "items": { "type": "string" },
        "default": ["light", "dark"]
      }
    }
  }
}
```

Manifest notes:

- `api` must match the exact string exposed by `HOST_API_VERSION` (for example, `v1`); incompatible plugins are skipped with an error.
- `entry` is resolved relative to the plugin folder and must export a default plugin with an `activate` function.
- `commands` describe user-facing commands and provide optional parameter schemas and per-command `timeoutMs`.
- `dependencies` is an optional map of dependency names to URLs. Combine multiple manifest maps with `mergeManifestDependencies`.
- `surfaces` is an optional JSON object mirrored by `createPluginHostRuntime`. Subscribers receive these entries through `getPluginSurfaces()` and `subscribeToPluginSurfaces()`.
- `settingsSchema` is validated with AJV. Invalid writes throw a `settings` command error.
- Extra properties are rejected by the schema to keep manifests predictable.

## Plugin Context

Command handlers receive a lightweight `PluginContext`:

- `ctx.id` / `ctx.manifest` – plugin identity and validated manifest metadata.
- `ctx.api.call("fs.readFile", { path })` – scoped file-system helpers backed by `@pstdio/opfs-utils` (`fs.writeFile`, `fs.deleteFile`, `fs.moveFile`, `fs.exists`, `fs.mkdirp` follow the same pattern).
- `ctx.api.call("settings.read")` / `ctx.api.call("settings.write", { value })` – JSON persistence to `/plugin_data/<id>/.settings.json`, with `settings.read` seeding defaults from `settingsSchema` the first time it runs.
- `ctx.api.call("log.statusUpdate", { status, detail? })` – emit structured status messages surfaced via `host.onStatus`.
- `ctx.api.call("log.error", { message })` / `ctx.api.call("log.warn", { message, detail? })` / `ctx.api.call("log.info", { message, detail? })` – forward plugin logs to the host notifier.

Plugins must export a default object with an `activate(ctx)` function. `deactivate()` is optional and runs on unload.

## Tiny AI Tasks Integration

Translate plugin commands into Tiny AI Tasks tools to expose them to LLM agents:

```ts
import { createHost, createToolsForCommands } from "@pstdio/tiny-plugins";

const host = createHost({ root: "plugins", dataRoot: "plugin-data" });
await host.start();

const tools = createToolsForCommands(host.listCommands(), (pluginId, commandId, params) =>
  host.runCommand(pluginId, commandId, params),
);
```

Each tool serialises execution results to a JSON payload, making it easy to forward plugin interactions through streaming agent pipelines built on `@pstdio/tiny-ai-tasks`.

## Export Reference

- `createHost(options?)` – build the low-level host used throughout this guide.
- `createPluginHostRuntime(options?)` – bootstrap a memoised runtime snapshot that mirrors plugin metadata, commands, settings schemas, dependency maps, and custom surfaces.
- `usePluginHost(options?)` / `usePlugins(options?)` – React hooks that manage the runtime lifecycle and surface live metadata.
- `subscribeToPluginFiles(pluginId, listener)` – stream batched file system change events for a specific plugin.
- `createToolsForCommands(commands, runner)` – adapt validated commands into Tiny AI Tasks tools.
- `mergeManifestDependencies(manifests, options?)` – coalesce dependency URL maps and detect conflicts.
- `createSettingsAccessor(host)` – read and persist plugin settings from outside the host instance.
- Download helpers: `pluginDownloadHelpers`, `downloadPluginBundle`, `downloadPluginData`, `downloadPluginSource`, `createZipFromDirectories`, `createZipBlob`, `downloadDirectory`, `deletePluginDirectories`, `listDirectoryEntries`, `triggerBlobDownload`, `sanitizeFileSegment`, `joinZipPath`, `buildRelativePath`.
- Type exports: `HostOptions`, `HostApi`, `Manifest`, `PluginMetadata`, `CommandDefinition`, `PluginChangePayload`, `StatusUpdate`, `PluginFilesEvent`, `PluginHostRuntime`, and more.
- Constant: `HOST_API_VERSION` – fixed plugin API identifier (e.g. `v1`).

### Runtime snapshot with `createPluginHostRuntime`

`createPluginHostRuntime` builds on `createHost` and keeps a cached snapshot of everything your UI needs to render plugin state. It subscribes to manifests, commands, dependency maps, and custom surfaces and replays the latest snapshot to every subscriber.

```ts
import { createPluginHostRuntime } from "@pstdio/tiny-plugins";

const runtime = createPluginHostRuntime({ root: "plugins" });

const commands = runtime.getPluginCommands();
const surfaces = runtime.getPluginSurfaces();

runtime.subscribeToPluginSurfaces((snapshot) => {
  renderSurfaces(snapshot);
});
```

The runtime lazily initialises the underlying host, batches manifest updates, and deduplicates surface snapshots so UI listeners only rerender when data changes.

### React hooks

`usePluginHost` owns a runtime instance for the lifetime of your component tree and exposes a memoised value you can pass to other hooks. `usePlugins` consumes that runtime and returns live metadata, commands, dependencies, and surface snapshots for display.

```tsx
import { usePluginHost, usePlugins } from "@pstdio/tiny-plugins";

function PluginPalette() {
  const hostRuntime = usePluginHost({ root: "plugins" });
  const { commands, surfaces } = usePlugins(hostRuntime);

  return <Palette commands={commands} surfaces={surfaces} />;
}
```

Both hooks automatically start and stop the host, making them safe to use in nested components or application shells.

### File-subscription batching

`subscribeToPluginFiles` delivers deduplicated change batches for a plugin, emitting structured `PluginFilesEvent` records even when the underlying file watcher only reports a path string.

```ts
import { subscribeToPluginFiles } from "@pstdio/tiny-plugins";

const unsubscribe = subscribeToPluginFiles("theme-switcher", (event) => {
  event.changes.forEach(({ type, path }) => {
    console.debug("file change", type, path.join("/"));
  });
});

// later
unsubscribe();
```

Use it alongside the runtime to trigger targeted refreshes after edits, OPFS syncs, or plugin hot reloads.

### Download utilities

The download helpers bundle plugin source, data, and dependency directories into shareable ZIP archives. They normalise relative paths, filter unsafe segments, and return `Blob` objects ready for download.

```ts
import { pluginDownloadHelpers } from "@pstdio/tiny-plugins";

const { downloadPluginBundle } = pluginDownloadHelpers({ root: "plugins", dataRoot: "plugin_data" });

await downloadPluginBundle({ pluginId: "theme-switcher" });
```

You can also call the lower-level helpers (`createZipFromDirectories`, `downloadDirectory`, `triggerBlobDownload`, etc.) to compose bespoke export workflows.

## Compatibility

- Requires environments with OPFS access (modern Chromium-based browsers) or a compatible `@pstdio/opfs-utils` adapter.
- Node 22+ is recommended for tooling that loads plugins server-side.
