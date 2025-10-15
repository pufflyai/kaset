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
import { createPluginHost } from "@pstdio/tiny-plugins";

const host = createPluginHost({
  root: "plugins",
  notify(level, message) {
    console[level === "error" ? "error" : "info"](`[plugin] ${message}`);
  },
});

await host.start();

const stopSync = host.subscribePlugins((plugins) => {
  renderPluginPalette(plugins);
});

host.subscribePluginFiles("theme-switcher", ({ changes }) => {
  highlightEditorChanges(changes);
});

const runThemeNext = host.runPluginCommand("theme-switcher", "theme.next");
await runThemeNext({ skipAnimation: true });

const settings = await host.readPluginSettings("theme-switcher");
await host.writePluginSettings("theme-switcher", { ...settings, current: "dark" });

await host.stop();
stopSync();
```

`createPluginHost` automatically watches the plugin root (default `plugins`) when `watch` is not disabled. It preloads every discovered plugin on `start()`, keeps manifests and commands in sync, and cleans up all timers, watchers, and object URLs when `stop()` is called.

## API Surface

- `start()` / `stop()` – control the lifecycle of the host and all loaded plugins.
- `isReady()` – check whether `start()` completed.
- `listPlugins()` / `subscribePlugins(cb)` – inspect plugin metadata and react to changes.
- `listCommands()` – retrieve all registered commands with their `pluginId`.
- `listPluginCommands(pluginId)` – narrow the command list to a single plugin.
- `runPluginCommand(pluginId, commandId)` – get a callable that validates params and executes the command under timeout control.
- `readPluginSettings(pluginId)` / `writePluginSettings(pluginId, value)` – persist JSON settings to `/plugin_data/<id>/.settings.json`, validating against the manifest schema when available.
- `readPluginManifest(pluginId)` – access the last loaded manifest copy.
- `subscribePluginManifest(pluginId, cb)` / `subscribeManifests(cb)` – track manifest updates.
- `subscribePluginFiles(pluginId, cb)` – receive OPFS change events for a plugin directory.
- `doesPluginExist(pluginId)` – check whether a plugin directory currently exists.

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

- `ctx.id` / `ctx.manifest` – plugin identity and manifest metadata.
- `ctx.log.{info|warn|error}` – namespaced logging helpers.
- `ctx.commands.notify(level, message)` – send structured notifications back to the host `notify` callback.
- `ctx.fs` – scoped file-system helpers backed by `@pstdio/opfs-utils` (`readFile`, `writeFile`, `deleteFile`, `moveFile`, `exists`, `mkdirp`, `readJSON`, `writeJSON`).
- `ctx.settings.{read, write}` – JSON persistence to `/plugin_data/<id>/.settings.json` with schema validation when declared.
- `ctx.net.fetch(url, init?)` – uses the global `fetch` implementation when available.

Plugins must export a default object with an `activate(ctx)` function. `deactivate()` is optional and runs on unload.

## Tiny AI Tasks Integration

Translate plugin commands into Tiny AI Tasks tools to expose them to LLM agents:

```ts
import { createPluginHost, createToolsForCommands } from "@pstdio/tiny-plugins";

const host = createPluginHost();
await host.start();

const tools = createToolsForCommands(host.listCommands(), (pluginId, commandId, params) => {
  return host.runPluginCommand(pluginId, commandId)(params);
});
```

Each tool serialises execution results to a JSON payload, making it easy to forward plugin interactions through streaming agent pipelines built on `@pstdio/tiny-ai-tasks`.

## Utilities & Exports

- `HOST_API_VERSION` – compare against manifest `api` ranges.
- `mergeManifestDependencies(manifests, options?)` – coalesce dependency URL maps and detect conflicts.
- Type exports: `PluginHost`, `HostOptions`, `CommandDefinition`, `RegisteredCommand`, `Manifest`, `PluginContext`, and more.

## Compatibility

- Requires environments with OPFS access (modern Chromium-based browsers) or a compatible `@pstdio/opfs-utils` adapter.
- Node 22+ is recommended for tooling that loads plugins server-side.
- Fetch support is optional but required for `ctx.net.fetch`. Provide a polyfill when running outside the browser.
