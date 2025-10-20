# Tiny Plugins

[![npm version](https://img.shields.io/npm/v/@pstdio/tiny-plugins.svg?color=blue)](https://www.npmjs.com/package/@pstdio/tiny-plugins)
[![license](https://img.shields.io/npm/l/@pstdio/tiny-plugins)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Ftiny-plugins)](https://bundlephobia.com/package/%40pstdio%2Ftiny-plugins)

> **OPFS-backed plugin host with manifest validation, hot-reload watchers, and command routing.**
> Load sandboxed plugins from the browser's file system, surface their commands, and keep per-plugin settings in sync.

## ✨ Why?

- Treat each plugin as an OPFS directory containing a `manifest.json` and entry module.
- Provide a stable host API (`fs`, `log`, and `settings`) that plugins can rely on.
- React to file system mutations immediately—reload code, surface new commands, and merge dependency declarations.
- Share the same primitives that power [`@pstdio/tiny-ui`](../tiny-ui/README.md) so UI shells can bridge into plugin code with a single call.

## 🏁 Quick start

### Installation

```bash
npm install @pstdio/tiny-plugins
```

### Minimal host lifecycle

```ts
import { createHost } from "@pstdio/tiny-plugins";

const host = createHost({
  root: "plugins", // OPFS directory containing plugin folders
  dataRoot: "plugin_data", // optional, defaults to "plugin_data"
  notify: (level, message) => console[level]("[plugins]", message),
});

await host.start();

host.onPluginChange((pluginId, payload) => {
  console.log(`reloaded ${pluginId}`, payload.manifest);
});

await host.runCommand("sample-plugin", "sayHello", { name: "Tiny" });
await host.updateSettings("sample-plugin", { enabled: true });

await host.stop();
```

Call `start()` once to read every plugin directory, validate manifests, import the entry module, and activate each plugin. `stop()` disposes watchers, revokes module URLs, and invokes `deactivate()` if it exists.

## 🔁 Host lifecycle: load → watch → command → settings

1. **Loading** – `start()` enumerates directories under `root`, validates `manifest.json` via [`core/manifest.ts`](./src/core/manifest.ts), imports the declared `entry`, and calls `plugin.activate(ctx)`.
2. **Watching** – When `watch: true` (default) the host wires [`watchPluginsRoot`](./src/core/watchers.ts) and [`watchPluginDir`](./src/core/watchers.ts) so that file changes trigger a reload, emit `pluginChange`, and refresh merged dependencies.
3. **Commands** – After activation the host registers the manifest-defined commands along with optional command exports. `runCommand(pluginId, commandId, params)` dispatches through the internal registry.
4. **Settings** – Each plugin receives a scoped data directory (under `dataRoot`). The host exposes `settings.read`/`settings.write` in the API and mirrors updates through `onSettingsChange`.

## 🧰 Host API surface

`createHost(options)` returns an object with the following capabilities:

- **Lifecycle** – `start()`, `stop()`.
- **Subscriptions** – `onPluginChange`, `onDependencyChange`, `onSettingsChange`, `onStatus`, `onError`.
- **Queries** – `getMetadata()`, `getPluginDependencies()`, `listCommands()`.
- **Actions** – `runCommand(pluginId, commandId, params?)`, `updateSettings(pluginId, value)`, `readSettings(pluginId)`.
- **UI bridge** – `createHostApiFor(pluginId)` returns the same host API handed to plugins during `activate()`. [`@pstdio/tiny-ui`](../tiny-ui/README.md) calls this helper inside its iframe bridge so UI surfaces share the exact capabilities via `api.call(method, params?)`.

Each plugin-facing API is exposed through `ctx.api.call(method, params?)` and includes:

- `fs.*` methods scoped to the plugin's directory (`readFile`, `writeFile`, `deleteFile`, `moveFile`, `exists`, `mkdirp`).
- `log.*` helpers (`statusUpdate`, `info`, `warn`, `error`) that forward to the host's `notify` callback and emit runtime events.
- `settings.read` / `settings.write` for persisting JSON-serializable state in the plugin's data directory.

## 🪄 Runtime orchestration helpers

The runtime layer builds on `createHost` to provide higher-level orchestration and React integrations.

### `createPluginHostRuntime(options)`

- Lazily spins up a host when the first subscriber asks for commands/settings/surfaces.
- Tracks manifest snapshots, merged dependencies, and surfaces declared in `manifest.surfaces`.
- Adapts host commands into [`Tool`](https://github.com/pufflyai/kaset/tree/main/packages/%40pstdio/tiny-ai-tasks) instances through `createToolsForCommands`.

```ts
import { createPluginHostRuntime } from "@pstdio/tiny-plugins";

const runtime = createPluginHostRuntime({ root: "plugins" });
const tools = runtime.getPluginTools(); // mirrors host commands

runtime.subscribeToPluginCommands((commands) => {
  console.table(commands);
});
```

### React hooks: `usePluginHost` and `usePlugins`

- `usePluginHost(runtime)` wraps the runtime API for React apps, returning `commands`, `tools`, `settings`, loading state, and helpers that proxy through to the host (e.g., `runCommand`, `readSettings`).
- `usePlugins(host)` is a lightweight hook for consumers that already instantiated a host themselves.

```tsx
const runtime = useMemo(() => createPluginHostRuntime({ root: "plugins" }), []);
const { commands, tools, runCommand } = usePluginHost(runtime);

return <PluginList commands={commands} onRun={(command) => runCommand(command.pluginId, command.id)} />;
```

Both hooks call back into the core host, so updates from the filesystem or settings propagate automatically.

## 📁 File subscriptions & change feeds

Use [`subscribeToPluginFiles`](./src/core/subscriptions.ts) when you need batched file-change notifications without adopting the full runtime:

```ts
import { createHost, subscribeToPluginFiles } from "@pstdio/tiny-plugins";

const host = createHost({ root: "plugins" });
await host.start();

const unsubscribe = subscribeToPluginFiles(host, (events) => {
  events.forEach(({ pluginId, payload }) => {
    console.log(pluginId, payload.paths);
  });
});
```

Each batch corresponds to a single microtask, preserving change order while coalescing rapid file updates.

## 📦 Download utilities

Browser helpers in [`helpers/plugin-downloads.ts`](./src/helpers/plugin-downloads.ts) package OPFS directories as ZIP archives:

- `downloadPluginSource({ pluginId, pluginsRoot, label? })`
- `downloadPluginData({ pluginId, pluginDataRoot, label? })`
- `downloadPluginBundle({ pluginId, pluginsRoot, pluginDataRoot, label? })`
- Lower-level building blocks: `downloadDirectory`, `createZipBlob`, `createZipFromDirectories`

```ts
import { downloadPluginBundle } from "@pstdio/tiny-plugins";

await downloadPluginBundle({
  pluginId: "sample-plugin",
  pluginsRoot: "plugins",
  pluginDataRoot: "plugin_data",
  label: "sample",
});
```

These utilities reuse `@pstdio/opfs-utils` to walk directories and `fflate` to stream ZIP contents, making it easy to export plugin code, data, or both for sharing/debugging.

## 📄 Manifest schema

`manifest.json` must satisfy the rules enforced in [`core/manifest.ts`](./src/core/manifest.ts):

- **Required**: `id`, `name`, `version` (valid semver), `api` (matches host API version, e.g. `"v1"`), and `entry` (module path).
- **Optional metadata**: `description`, `dependencies` (merged into host-wide map), `commands` (array of `{ id, title, ... }`), and `ui` (forwarded verbatim).
- **Settings**: `settingsSchema` is accepted and surfaced by the runtime so UIs can render forms or validation.
- **Surfaces**: `surfaces` (record of surface metadata) is consumed by the runtime to drive Tiny UI panes or other host experiences.

At load time the host ensures `manifest.id` matches the directory name, the `api` matches the host's `hostApiVersion`, and warns when `entry` is not a JavaScript/TypeScript module.

## 🔗 Working with Tiny UI

[`@pstdio/tiny-ui`](../tiny-ui/README.md) composes Tiny Plugins to render plugin user interfaces inside sandboxed iframes. It uses `createHostApiFor(pluginId)` to hand the exact same host bridge into each iframe, ensuring parity between headless command execution and interactive surfaces.

When a manifest declares `surfaces`, the runtime exposes them via `getPluginSurfaces()` and `subscribeToPluginSurfaces()`, letting Tiny UI mount views like settings panels or dashboards. Use the download helpers above to package those surfaces alongside their plugin code for distribution.

---

Need help? File an issue or join the conversation in the [Kaset repository](https://github.com/pufflyai/kaset).
