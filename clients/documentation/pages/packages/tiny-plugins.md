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
- `readSettings(pluginId)` / `updateSettings(pluginId, value)` – persist JSON settings under `/plugin_data/<id>/.settings.json`.
- `createHostApiFor(pluginId)` – expose the string-keyed host API (fs/logs/settings) for Tiny UI bridges.

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
  "api": "^1.0.0",
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

- `api` must satisfy the major version exposed by `HOST_API_VERSION`; incompatible plugins are skipped with an error.
- `entry` is resolved relative to the plugin folder and must export a default plugin with an `activate` function.
- `commands` describe user-facing commands and provide optional parameter schemas and per-command `timeoutMs`.
- `dependencies` is an optional map of dependency names to URLs. Combine multiple manifest maps with `mergeManifestDependencies`.
- `settingsSchema` is validated with AJV. Invalid writes throw a `settings` command error.
- Extra properties are rejected by the schema to keep manifests predictable.

## Plugin Context

Command handlers receive a lightweight `PluginContext`:

- `ctx.id` / `ctx.manifest` – plugin identity and validated manifest metadata.
- `ctx.api["fs.readFile"](path)` – scoped file-system helpers backed by `@pstdio/opfs-utils` (`writeFile`, `deleteFile`, `moveFile`, `exists`, `mkdirp` are also available under the `fs.*` namespace).
- `ctx.api["settings.read"]()` / `ctx.api["settings.write"](value)` – JSON persistence to `/plugin_data/<id>/.settings.json`.
- `ctx.api["log.statusUpdate"]({ status, detail? })` – emit structured status messages surfaced via `host.onStatus`.
- `ctx.api["log.error"](message)` / `ctx.api["log.warn"](message)` / `ctx.api["log.info"](message)` – forward plugin logs to the host notifier.

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

## Utilities & Exports

- `HOST_API_VERSION` – compare against manifest `api` ranges.
- `mergeManifestDependencies(manifests, options?)` – coalesce dependency URL maps and detect conflicts.
- Type exports: `HostOptions`, `HostApi`, `Manifest`, `PluginMetadata`, `CommandDefinition`, `PluginChangePayload`, `StatusUpdate`.
- Helpers: `createToolsForCommands`, `createActionApi`, `createSettingsAccessor`.

## Compatibility

- Requires environments with OPFS access (modern Chromium-based browsers) or a compatible `@pstdio/opfs-utils` adapter.
- Node 22+ is recommended for tooling that loads plugins server-side.
- Fetch support is optional but required for `ctx.net.fetch`. Provide a polyfill when running outside the browser.
