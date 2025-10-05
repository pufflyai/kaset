---
title: Plugins
---

# Plugins

Plugins help teams move faster by letting third parties extend the app. A clear API keeps customizations easy to share while preserving a stable contract between the host and extensions.

:::info
The trade-off is that plugins can only reach the surfaces you expose.
:::

In Kaset **Plugins** are small, user-editable extensions that run entirely in the browser. They are loaded by the `kaset-plugin-host` library, which provides a runtime, declarative UI surfaces, and webview support for custom UX.

## Workspace layout

Each workspace has one plugins root and a public state area:

```
/plugins/
  <plugin-id>/
    manifest.json              # metadata, permissions, activation
    index.js                   # ESM module exporting default
    assets/**                  # optional static assets used by the plugin
```

- **Editable**: Plugins are plain files in OPFS; agents (or users) can edit them.
- **Hot‑reload**: When enabled, the host watches `/plugins/**` and soft‑reloads changed plugins.

## Manifest schema

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
  "settingsSchema": {
    "type": "object",
    "properties": {
      "current": { "type": "string", "default": "light" }
    }
  }
}
```

**Key fields**

- `api`: host API compatibility. Host rejects plugins whose range doesn’t match `"1.x"`.
- `activation`: **when** the host should wake a plugin (see _Lifecycle & activation_).
- `permissions`: FS globs for read/write and optional network allowlist (see _Permission model_).
- `commands`: declarative command metadata.
- `settingsSchema`: JSON Schema for persisted settings (host validates & stores).

## How Kaset loads plugins

1. **Discover**
   Enumerate `/plugins/*/manifest.json`.

2. **Validate**
   Check `api` range compatibility; deny access to reserved paths (`/state/secure/**`).

3. **Load**
   Read `entry`, create a **Blob URL**, and `import()` it as an ESM module.

4. **Build context**
   Construct a `PluginContext` with permission‑checked FS, optional `net.fetch`, logging, settings, events, scheduler, and a cancellation signal.

5. **Activate**
   Call `plugin.activate(ctx)` under a time budget (default 10s). Register commands declared in the manifest, binding their handlers.

6. **Wire activation routes**
   - `onStartup` → nothing extra (activate already called)
   - `onCommand` → routed via the command registry
   - `onFSChange` → OPFS watcher filtered by your glob
   - `onEvent` → app emits `host.emit(name, payload)`

7. **Hot reload (optional)**
   On OPFS changes within a plugin folder, the host cancels the old context, runs `deactivate?`, and reimports.

## Permission model

**Default‑deny.** Plugins get nothing unless declared.

### Filesystem (OPFS)

- **Read** allowed only if path matches `permissions.fs.read` globs.
- **Write/move/delete** allowed only if path matches `permissions.fs.write` globs.
- **Always denied**: `/state/secure/**` (hardcoded by host, not overridable).

### Network (optional)

- Only enabled if the app passes `netFetch` to the host.
- If enabled, `ctx.net.fetch(url)` is allowed **only** when `new URL(url).origin` (or hostname) matches `permissions.net`.
- The host performs the allowlist check and delegates to `netFetch`.

### Time & fault budgets

- `activate`: 10s, `command`: 10s, `deactivate`: 5s (defaults; configurable).
- Repeated failures can auto‑disable a plugin after N consecutive errors (host policy).

## Runtime surfaces

**Declarative only**

- **Commands**
  Declared in the manifest and surfaced through your app via the `UIAdapter`. Handlers come from the plugin module (`export const commands = { ... }`) or via `ctx.commands.invoke(id)`.

- **Settings**
  JSON Schema‑driven settings persisted under `/state/public/plugins/<id>.json`. The host notifies the app via `ui.onSettingsSchema(pluginId, schema)` so you can render a form.

- **Notifications**
  Optional `ui.notify(level, message)` adapter for transient toasts or console logs.

## Lifecycle & activation

- **activate(ctx)**
  Initialize, subscribe to events, schedule work, hydrate settings.

- **deactivate?()**
  Release resources. The host also aborts `ctx.cancelToken` and calls all `ctx.disposables`.

- **Activation events**
  - `onStartup`: run once on host load.
  - `onCommand`: user or app invokes a command.
  - `onFSChange`: path changes under a glob trigger a plugin event.
  - `onEvent`: app‑level events via `host.emit(name, payload)`.

## Webviews

For custom UI, a plugin may declare **webviews/panels** rendered in sandboxed iframes.

- **Manifest (preview)**
  `ui.webviews?: [{ id, title, entryHtml?: "panel.html" }]`
- **Sandboxing**
  `iframe sandbox="allow-scripts"` (no `allow-same-origin`), src is a Blob URL created from OPFS content.
- **RPC**
  `postMessage` channel; host exposes a small RPC surface (fs, settings, commands). All permission checks still apply.
- **Theming**
  Host sends design tokens on load; the webview chooses whether to adopt them.

## Host integration

Bind host surfaces to your app with the **UI Adapter**.

```ts
import { createPluginHost } from "kaset-plugin-host";

const ui = {
  onCommandsChanged(cmds) {
    // Expose to your command palette
    window.__commands = cmds;
  },
  notify(level, msg) {
    console[level === "error" ? "error" : "log"]("[plugin]", msg);
  },
  onSettingsSchema(pluginId, schema) {
    // Render a settings form for this plugin id using the provided schema
  },
};

const host = createPluginHost({
  ui,
  netFetch: (url, init) => fetch(url, init),
  watchPlugins: true,
});

await host.loadAll();

// Example: invoke from your palette
function runCommand(pid, cid, params) {
  host.invokeCommand(pid, cid, params);
}

// App → plugin event bridge
host.emit("app:userSignedIn", { userId: "123" });
```

## API quicksheet (for plugin authors)

```ts
// index.js (ESM)
export const commands = {
  async "myPlugin.hello"(ctx) {
    const s = await ctx.settings.read();
    ctx.ui.notify?.("info", `Hello ${s.name || "world"}!`);
  },
};

export default {
  async activate(ctx) {
    // Listen for FS changes via ctx.events if you declared activations
    ctx.log.info("activated");
  },
  async deactivate() {
    // optional cleanup
  },
};
```

**Inside `activate(ctx)`**

- `ctx.fs`: { ls, readFile, writeFile, moveFile, deleteFile } (permission‑checked)
- `ctx.grep`, `ctx.patch`, `ctx.processSingleFileContent` (from `@pstdio/opfs-utils`)
- `ctx.settings`: `read<T>(), write<T>(value)`
- `ctx.ui`: `notify?(level, message)` (adapter-routed)
- `ctx.commands`: `invoke(id, params?)`
- `ctx.scheduler`: cron/interval hooks (host‑provided)
- `ctx.events`: event bus (plugin emits/listens within host constraints)
- `ctx.net?`: `{ fetch(url, init) }` (if host enabled + domain allowlisted)
- `ctx.cancelToken`: `AbortSignal` cancelled on reload/unload
- `ctx.disposables`: array of `{ dispose(): void | Promise<void> }` (host calls on unload)

## Reference plugins

### 1) Slack Notifier (FS trigger → Slack webhook)

**`/plugins/slack-notifier/manifest.json`**

```json
{
  "id": "slack-notifier",
  "name": "Slack Notifier",
  "version": "0.1.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "commands": [{ "id": "slack.test", "title": "Slack: Send Test Notification", "category": "Slack" }],
  "settingsSchema": {
    "type": "object",
    "properties": {
      "webhookUrl": { "type": "string", "format": "uri" },
      "channel": { "type": "string" },
      "username": { "type": "string", "default": "Kaset Bot" }
    },
    "required": ["webhookUrl"]
  }
}
```

**`/plugins/slack-notifier/index.js`**

```js
export const commands = {
  async "slack.test"(ctx) {
    const cfg = await ctx.settings.read();
    if (!cfg.webhookUrl || !ctx.net) {
      ctx.ui.notify?.("warn", "Set Slack webhook URL and ensure net.fetch is enabled.");
      return;
    }
    await post(ctx, cfg, "This is a test from Slack Notifier ✅");
    ctx.log.info("test sent");
  },
};

export default {
  async activate(ctx) {
    ctx.events.on?.("fs:change", async ({ change }) => {
      if (!change.path.join("/").endsWith(".md")) return;
      try {
        const path = "/" + change.path.join("/");
        const raw = await ctx.fs.readFile(path);
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
        const status = text.match(/^status:\s*"?([^"\n]+)"?/m)?.[1];
        const completedAt = text.match(/^completedAt:\s*"?([^"\n]+)"?/m)?.[1];
        if (status === "done" && completedAt) {
          const cfg = await ctx.settings.read();
          if (cfg.webhookUrl && ctx.net) {
            await post(ctx, cfg, `✅ Completed: ${extractTitle(text)} (${path})`);
          }
        }
      } catch (e) {
        ctx.log.warn("parse failed", String(e));
      }
    });
  },
};

async function post(ctx, cfg, text) {
  const body = { text, username: cfg.username || "Kaset Bot" };
  if (cfg.channel) body.channel = cfg.channel;
  const res = await ctx.net.fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}

function extractTitle(md) {
  return md.match(/^title:\s*"?([^"\n]+)"?/m)?.[1] || "Untitled";
}
```

### 2) Theme Switcher (command + settings)

**`/plugins/theme-switcher/manifest.json`**

```json
{
  "id": "theme-switcher",
  "name": "Theme Switcher",
  "version": "0.1.0",
  "api": "^1.0.0",
  "entry": "index.js",
  "commands": [{ "id": "theme.next", "title": "Theme: Next", "category": "Appearance" }],
  "settingsSchema": {
    "type": "object",
    "properties": {
      "themes": { "type": "array", "items": { "type": "string" }, "default": ["light", "dark", "solarized"] },
      "current": { "type": "string", "default": "light" }
    }
  }
}
```

**`/plugins/theme-switcher/index.js`**

```js
export const commands = {
  async "theme.next"(ctx) {
    const s = await readState(ctx);
    const idx = s.themes.indexOf(s.current);
    s.current = s.themes[(idx + 1) % s.themes.length];
    await writeState(ctx, s);
    ctx.events.emit?.("kaset.themeChanged", { current: s.current });
    ctx.ui.notify?.("info", `Theme: ${s.current}`);
  },
};

export default {
  async activate(ctx) {
    const s = await readState(ctx);
    await writeState(ctx, s);
    ctx.events.emit?.("kaset.themeChanged", { current: s.current });
  },
};

async function readState(ctx) {
  const s = await ctx.settings.read();
  if (!s.themes) s.themes = ["light", "dark", "solarized"];
  if (!s.current) s.current = s.themes[0];
  return s;
}

async function writeState(ctx, s) {
  await ctx.settings.write(s);
  await ctx.fs.writeFile("/state/public/theme.json", JSON.stringify(s, null, 2));
}
```
