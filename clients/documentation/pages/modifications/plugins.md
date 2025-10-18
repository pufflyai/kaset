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
import { createHost } from "@pstdio/tiny-plugins";

const host = createHost({
  root: "plugins",
  dataRoot: "plugin-data",
  watch: true,
  notify(level, message) {
    const prefix = "[plugin]";
    if (level === "error") console.error(prefix, message);
    else if (level === "warn") console.warn(prefix, message);
    else console.info(prefix, message);
  },
});

await host.start();

const offChange = host.onPluginChange((pluginId, payload) => {
  renderCommandPalette(host.getMetadata());
  console.debug("files changed", pluginId, payload.paths);
});

const offDeps = host.onDependencyChange(({ deps }) => refreshDependencyInspector(deps));

await host.runCommand("theme-switcher", "theme.next", { skipAnimation: true });

const settings = await host.readSettings<{ current?: string }>("theme-switcher");
await host.updateSettings("theme-switcher", { ...settings, current: "dark" });

offChange();
offDeps();
await host.stop();
```

### Host API Summary

- `start()` / `stop()` – boot and teardown the host plus all plugin watchers.
- `onPluginChange(cb)` – receive manifest snapshots, changed file paths, and file listings per plugin.
- `onDependencyChange(cb)` – observe the merged dependency map across loaded plugins.
- `onSettingsChange(cb)` – track persisted settings updates.
- `onStatus(cb)` / `onError(cb)` – propagate host notifications.
- `getMetadata()` – view plugin metadata (id, name, version).
- `getPluginDependencies()` – read the merged dependency map.
- `listCommands()` – enumerate registered commands.
- `runCommand(pluginId, commandId, params?)` – execute a plugin command directly.
- `readSettings(pluginId)` / `updateSettings(pluginId, value)` – persist JSON to `/plugin_data/<id>/.settings.json`.
- `createHostApiFor(pluginId)` – provide the namespaced host API for Tiny UI bridges.

All subscription helpers return an unsubscribe function for cleanup.

## Plugin Author Quickstart

```js
// /plugins/theme-switcher/index.js

export const commands = {
  async "theme.next"(ctx, params = {}) {
    const settings = await ctx.api["settings.read"]();
    const themes = Array.isArray(settings.themes) && settings.themes.length > 0 ? settings.themes : ["light", "dark"];
    const current = typeof settings.current === "string" ? settings.current : themes[0];
    const nextIndex = (themes.indexOf(current) + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    await ctx.api["settings.write"]({ ...settings, current: nextTheme });

    if (!params.skipNotification) {
      await ctx.api["logs.statusUpdate"]({ status: "theme.changed", detail: { theme: nextTheme } });
    }
  },
};

export default {
  async activate(ctx) {
    await ctx.api["logs.statusUpdate"]({ status: "theme-switcher activated" });
  },
  async deactivate() {
    console.info("theme-switcher deactivated");
  },
};
```

### `PluginContext` Surface

- `ctx.id` / `ctx.manifest` – plugin metadata.
- `ctx.api["fs.readFile"](path)` – scoped filesystem helpers from `@pstdio/opfs-utils` (`fs.writeFile`, `fs.deleteFile`, `fs.moveFile`, `fs.exists`, `fs.mkdirp`).
- `ctx.api["settings.read"]<T>()` / `ctx.api["settings.write"](value)` – persist JSON to `/plugin_data/<id>/.settings.json`, validated against `settingsSchema` when provided.
- `ctx.api["logs.statusUpdate"]({ status, detail? })` – bridge notifications to the host `notify` callback.
- `ctx.api["logs.logError"]({ message })` – forward errors to the host notifier.

`activate(ctx)` runs once per load. `deactivate()` is optional and executes on unload or reload.

## Notifications & Settings

- **Notifications** – call `ctx.api["logs.statusUpdate"]({ status, detail })` to surface feedback. The host forwards the message to its `notify` handler, so apps can display toasts or log structured output. Use `ctx.api["logs.logError"]({ message })` for error conditions.
- **Settings** – stored at `/plugin_data/<id>/.settings.json`. Reads return `{}` when the file is missing or invalid JSON. Writes are pretty-printed and validated against `settingsSchema` via `ctx.api["settings.write"]`.

## Tiny AI Tasks Integration

Plugins pair naturally with AI-driven workflows. Use `createToolsForCommands` to convert commands into Tiny AI Tasks tools:

```ts
import { createHost, createToolsForCommands } from "@pstdio/tiny-plugins";

const host = createHost({ root: "plugins", dataRoot: "plugin-data" });
await host.start();

const tools = createToolsForCommands(host.listCommands(), (pluginId, commandId, params) =>
  host.runCommand(pluginId, commandId, params),
);
```

Each generated tool emits a JSON payload summarising the executed plugin command, making it easy to plug into `@pstdio/tiny-ai-tasks` agent loops.

## Compatibility Notes

- Works in browsers with OPFS support (Chromium-based browsers today). For Node-based tooling, use a compatible `@pstdio/opfs-utils` adapter.
- Node 22+ is recommended for headless usage (matching the repo baseline).
- Provide a global `fetch` (or polyfill) when running outside the browser to keep `ctx.net.fetch` available.
- Long-running commands or activations can adjust timeouts via `createHost({ defaultTimeoutMs })` or per-command `timeoutMs` in the manifest.
