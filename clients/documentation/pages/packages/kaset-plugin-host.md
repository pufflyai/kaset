---
title: "@pstdio/kaset-plugin-host"
---

# @pstdio/kaset-plugin-host

A browser-first plugin runtime for Kaset. The host loads user-editable plugins from the Origin Private File System (OPFS), validates manifests against the host API version, and wires commands, settings, and lifecycle hooks into your application.

Use it to bring fully editable automations, command palettes, and UI extensions to Kaset-powered apps without shipping new builds.

## Key Features

- Load plugins straight from OPFS with no server round-trips
- Validate manifests and surface command metadata, activation rules, and permissions
- Provide a scoped execution context with FS, settings, network, UI, and event helpers
- Watch plugin directories for hot reloads and manifest updates
- Persist plugin settings under `state/public/plugins/<pluginId>.json` in OPFS
- Ship a Tiny AI Tasks adapter to expose plugin commands as AI tools

## Installation

```bash
npm i @pstdio/kaset-plugin-host
```

## Browser Usage

`createBrowserPluginHost` wraps the core runtime with OPFS helpers so web apps can enumerate commands, track manifests, and execute plugin code entirely in the browser.

```ts
import { createBrowserPluginHost } from "@pstdio/kaset-plugin-host";

const host = createBrowserPluginHost({
  root: "plugins",
  notify(level, message) {
    console[level === "error" ? "error" : "log"]("[plugin]", message);
  },
});

await host.start();

host.subscribeCommands((commands) => {
  renderCommandPalette(commands);
});

host.subscribePluginFiles("theme-switcher", ({ changes }) => {
  refreshEditor(changes);
});

await host.runCommand("theme-switcher", "theme.next");
```

Browser host capabilities:

- Keeps command, plugin, and manifest lists in sync with OPFS
- Exposes helpers for reading and writing plugin settings (`readSettings` / `writeSettings`)
- Provides live file change notifications when `watch` (default) is enabled
- Creates missing directories on start by writing a temporary `.keep` file
- Falls back gracefully if manifests or plugin folders disappear

## Core Runtime Usage (Headless / Node)

`createPluginHost` is the lower-level API that powers the browser helper. Use it in tests, server-side validation, or custom environments that already manage file access.

```ts
import { createPluginHost } from "@pstdio/kaset-plugin-host";

const host = createPluginHost({
  pluginsRoot: "plugins",
  watchPlugins: true,
  ui: {
    onCommandsChanged(commands) {
      syncPalette(commands);
    },
    notify(level, message) {
      logger[level](message);
    },
    onSettingsSchema(pluginId, schema) {
      cacheSchema(pluginId, schema);
    },
  },
  netFetch(url, init) {
    return fetch(url, init);
  },
});

await host.loadAll();

await host.invokeCommand("theme-switcher", "theme.next");

const settings = await host.readSettings("theme-switcher");
await host.writeSettings("theme-switcher", { ...settings, currentTheme: "dark" });

await host.unloadAll();
```

Core host methods:

- `loadAll()` / `unloadAll()` – manage the lifecycle of all plugins
- `reloadPlugin(id)` – re-import code and re-run manifests after edits
- `invokeCommand(pluginId, commandId)` – execute a specific command handler
- `listCommands()` – retrieve the registered command list
- `emit(name, payload)` – broadcast custom events to every plugin
- `getSettingsSchema(pluginId)` – read the manifest-declared JSON schema
- `readSettings(pluginId)` / `writeSettings(pluginId, value)` – persist plugin state

## Plugin Layout

```
/plugins/
  <plugin-id>/
    manifest.json
    index.js
```

Hosts expect the plugin directory name to match the manifest `id`. Files live inside OPFS when running in the browser.

## Manifest Reference

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.1.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "ui": {
    "commands": [{ "id": "theme.next", "title": "Theme: Next", "category": "Appearance" }]
  },
  "permissions": {
    "fs": {
      "read": ["/docs/**"],
      "write": ["/state/public/plugins/theme-switcher.json"]
    }
  }
}
```

Manifest fields:

- `api` must satisfy the major version exposed by `HOST_API_VERSION`
- `entry` points to the ES module that exports the plugin implementation
- `activation` configures lifecycle triggers (currently `onFSChange` is implemented)
- `permissions` constrain file-system and network access requested by the plugin
- `ui.commands` registers commands that can be wired into palettes or menus
- `settingsSchema` surfaces JSON schema metadata that the host shares with UIs

## Events, Settings, and Disposables

Plugins receive a scoped context:

- **Settings**: use `ctx.settings.read()` / `ctx.settings.write(value)` to manage persisted state stored under `state/public/plugins/<pluginId>.json`.
- **Events**: call `ctx.events.on("app:userSignedIn", listener)` to react to host-emitted events and push cleanup handlers onto `ctx.disposables` for automatic teardown.
- **UI helpers**: `ctx.ui.notify(level, message)` surfaces toast-style notifications (if configured) and `ctx.ui.invoke(commandId)` runs other commands.
- **Filesystem**: `ctx.fs` exposes `readFile`, `writeFile`, `deleteFile`, `moveFile`, and `ls` via `@pstdio/opfs-utils`.
- **Network**: when `netFetch` is provided to the host, `ctx.net.fetch(url, init)` mirrors that capability to plugins.

## Tiny AI Tasks Integration

The package exports `createToolsForCommands` to translate plugin commands into Tiny AI Tasks tools.

```ts
import { createBrowserPluginHost } from "@pstdio/kaset-plugin-host";
import { createToolsForCommands } from "@pstdio/kaset-plugin-host/browser/adapters/tiny-ai-tasks";

const browserHost = createBrowserPluginHost({ root: "plugins" });
await browserHost.start();

const tools = createToolsForCommands(browserHost.listCommands(), (pluginId, commandId) => {
  return browserHost.runCommand(pluginId, commandId);
});
```

Each generated tool forwards execution to `browserHost.runCommand`, returning a JSON payload describing the plugin and command that executed.

## Exported Types and Utilities

The package re-exports useful types so consumers can type their integrations:

- `createBrowserPluginHost`, `BrowserPluginHost`, `BrowserHostOptions`
- `createPluginHost`, `PluginHost`, `HostConfig`
- `PluginContext`, `RegisteredCommand`, `EventsApi`, `FSApi`, `SettingsApi`, `UIAdapter`
- `Manifest`, `ActivationEvent`, `Permissions`, `JSONSchema`
- `HOST_API_VERSION` constant for compatibility checks

## Compatibility Notes

- Node 22+ is required when running the core host in Node environments.
- `watchPlugins` defaults to `true`. Disable it if your environment cannot watch OPFS.
- Plugins compiled for browser usage should export an object with an `activate` function. Optional `deactivate` handlers run during unload.
- Network access is only available when `netFetch` is provided at host creation.
