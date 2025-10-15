---
title: Plugins
---

# Plugins

Plugins let your users extend Kaset-powered apps without redeploying. Every plugin lives entirely in the browser inside the Origin Private File System (OPFS), so end users and agents can edit source files directly.

Plugins are loaded by `@pstdio/tiny-plugins`, the new runtime that replaced `kaset-plugin-host`. The runtime watches the plugins directory, validates manifests against the current host API version, and exposes commands and settings back to your UI.

:::info
Plugins can only touch the surfaces that the host runtime exposes. Keep the contract tight so extensions stay predictable.
:::

## Workspace Layout

```
/plugins/
  <plugin-id>/
    manifest.json        # metadata, commands, optional settings schema
    index.js             # default export with activate()
    assets/**            # optional static files referenced by the plugin

/plugin_data/
  <plugin-id>/
    .settings.json       # created by the host after first write
```

- **Editable**: OPFS keeps plugin code local to the browser. Agents can rewrite modules, manifests, or assets on the fly.
- **Hot reload**: The host watches `/plugins/**` (enabled by default) and reloads plugins when files change.

## Manifest Essentials

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.2.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "commands": [
    {
      "id": "theme.next",
      "title": "Theme: Next",
      "description": "Cycle to the next accent theme.",
      "category": "Appearance",
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

Key details:

- `api` must satisfy the semantic range exposed by `HOST_API_VERSION`. Incompatible plugins are skipped with a descriptive error.
- `entry` points to an ES module relative to the plugin folder. The default export must implement `activate(ctx)`.
- `commands` declare user-facing actions. Each entry may include parameter schemas and custom timeouts. Missing handlers are logged as warnings.
- `dependencies` is an optional map of dependency identifiers to URLs. Use `mergeManifestDependencies` to combine dependency maps from multiple manifests.
- `settingsSchema` is validated with AJV before writes. If validation fails, `writePluginSettings` rejects with details.

## How `@pstdio/tiny-plugins` Loads Plugins

1. **Discover**  
   Enumerates `/plugins/*/manifest.json`. Directory names must match manifest `id`.

2. **Validate**  
   Parses manifests and validates against the built-in JSON Schema. The host rejects manifests with unknown fields or invalid structures.

3. **Check compatibility**  
   Ensures the manifest `api` range includes `HOST_API_VERSION`. Major-version mismatches stop the plugin from loading.

4. **Load module**  
   Reads `entry`, creates a Blob URL, and `import()`s the module inside the browser context.

5. **Build context**  
   Creates a scoped file system helper rooted at the plugin directory, settings accessors, a logger, a notification bridge, and `net.fetch`. Command handlers reuse this context.

6. **Activate**  
   Calls `plugin.activate(ctx)` under a configurable timeout (`activate` default 10 s). Command handlers are registered once activation succeeds.

7. **Watch for changes**  
   When watching is enabled (default), file changes within the plugin folder trigger a reload. The host unsubscribes old watchers, runs `deactivate?()`, and loads the plugin again.

## Host Integration

```ts
import { createPluginHost } from "@pstdio/tiny-plugins";

const host = createPluginHost({
  root: "plugins",
  notify(level, message) {
    const prefix = "[plugin]";
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.info(prefix, message);
  },
});

await host.start();

const unsubscribePlugins = host.subscribePlugins((plugins) => {
  renderCommandPalette(plugins);
});

const unsubscribeChanges = host.subscribePluginFiles("theme-switcher", ({ changes }) => {
  refreshEditor(changes);
});

const runThemeNext = host.runPluginCommand("theme-switcher", "theme.next");
await runThemeNext({ skipAnimation: true });

const settings = await host.readPluginSettings("theme-switcher");
await host.writePluginSettings("theme-switcher", { ...settings, current: "dark" });

await host.stop();
unsubscribePlugins();
unsubscribeChanges();
```

### Host API Summary

- `start()` / `stop()` – boot and teardown the host plus all plugin watchers.
- `isReady()` – check whether `start()` finished.
- `listPlugins()` / `subscribePlugins(cb)` – view plugin metadata (id, name, version) and react to changes.
- `listCommands()` / `listPluginCommands(pluginId)` – enumerate registered commands.
- `runPluginCommand(pluginId, commandId)` – obtain an async runner that validates params and executes the handler with timeout guarantees.
- `readPluginSettings(pluginId)` / `writePluginSettings(pluginId, value)` – persist JSON to `/plugin_data/<id>/.settings.json` with AJV validation.
- `readPluginManifest(pluginId)` – fetch the latest manifest snapshot.
- `subscribePluginManifest(pluginId, cb)` / `subscribeManifests(cb)` – observe manifest updates.
- `subscribePluginFiles(pluginId, cb)` – receive OPFS change notifications for a plugin directory.
- `doesPluginExist(pluginId)` – quick existence check for UI affordances.

All subscription helpers return an unsubscribe function for cleanup.

## Plugin Author Quickstart

```js
// /plugins/theme-switcher/index.js

export const commands = {
  async "theme.next"(ctx, params = {}) {
    const settings = await ctx.settings.read();
    const themes = Array.isArray(settings.themes) && settings.themes.length > 0 ? settings.themes : ["light", "dark"];
    const current = typeof settings.current === "string" ? settings.current : themes[0];
    const nextIndex = (themes.indexOf(current) + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    await ctx.settings.write({ ...settings, current: nextTheme });

    if (!params.skipNotification) {
      ctx.commands.notify("info", `Theme switched to ${nextTheme}`);
    }
  },
};

export default {
  async activate(ctx) {
    ctx.log.info("theme-switcher activated");
  },
  async deactivate() {
    console.info("theme-switcher deactivated");
  },
};
```

### `PluginContext` Surface

- `ctx.id` / `ctx.manifest` – plugin metadata.
- `ctx.log` – namespaced `{ info, warn, error }` logger.
- `ctx.commands.notify(level, message)` – bridge notifications to the host `notify` callback.
- `ctx.fs` – scoped filesystem helpers from `@pstdio/opfs-utils` (`readFile`, `writeFile`, `deleteFile`, `moveFile`, `exists`, `mkdirp`, `readJSON`, `writeJSON`).
- `ctx.settings.read<T>()` / `ctx.settings.write(value)` – persist JSON to `/plugin_data/<id>/.settings.json`, validated against `settingsSchema` when provided.
- `ctx.net.fetch(url, init?)` – reuses the global `fetch` implementation (polyfill when needed).

`activate(ctx)` runs once per load. `deactivate()` is optional and executes on unload or reload.

## Notifications & Settings

- **Notifications** – call `ctx.commands.notify(level, message)` to surface feedback. The host sends the message to its `notify` handler, so apps can display toasts or log structured output.
- **Settings** – stored at `/plugin_data/<id>/.settings.json`. Reads return `{}` when the file is missing or invalid JSON. Writes are pretty-printed and validated against `settingsSchema`.

## Tiny AI Tasks Integration

Plugins pair naturally with AI-driven workflows. Use `createToolsForCommands` to convert commands into Tiny AI Tasks tools:

```ts
import { createPluginHost, createToolsForCommands } from "@pstdio/tiny-plugins";

const host = createPluginHost();
await host.start();

const tools = createToolsForCommands(host.listCommands(), (pluginId, commandId, params) => {
  return host.runPluginCommand(pluginId, commandId)(params);
});
```

Each generated tool emits a JSON payload summarising the executed plugin command, making it easy to plug into `@pstdio/tiny-ai-tasks` agent loops.

## Compatibility Notes

- Works in browsers with OPFS support (Chromium-based browsers today). For Node-based tooling, use a compatible `@pstdio/opfs-utils` adapter.
- Node 22+ is recommended for headless usage (matching the repo baseline).
- Provide a global `fetch` (or polyfill) when running outside the browser to keep `ctx.net.fetch` available.
- Long-running commands or activations can adjust timeouts via `createPluginHost({ timeouts: { command, activate, deactivate } })`.
