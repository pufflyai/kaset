# @pstdio/kaset-plugin-host

[![npm version](https://img.shields.io/npm/v/@pstdio/kaset-plugin-host.svg?color=blue)](https://www.npmjs.com/package/@pstdio/kaset-plugin-host)
[![license](https://img.shields.io/npm/l/@pstdio/kaset-plugin-host)](https://github.com/pufflyai/kaset/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fkaset-plugin-host)](https://bundlephobia.com/package/%40pstdio%2Fkaset-plugin-host)

Plugin runtime for Kaset. The host loads user-editable plugins from OPFS, validates manifests, wires declarative UI surfaces, and provides a permission-scoped execution context.

For additional information, see the [Plugins documentation](https://pufflyai.github.io/kaset/modifications/plugins).

## Quick Start

### Installation

```bash
npm i @pstdio/kaset-plugin-host
```

### Usage

```ts
import { createPluginHost } from "@pstdio/kaset-plugin-host";

const host = createPluginHost({
  ui: {
    onCommandsChanged(commands) {
      window.__commands = commands;
    },
    notify(level, message) {
      console[level === "error" ? "error" : "log"]("[plugin]", message);
    },
    onSettingsSchema(pluginId, schema) {
      renderSettingsForm(pluginId, schema);
    },
  },
  watchPlugins: true,
  netFetch: (url, init) => fetch(url, init),
});

await host.loadAll();
host.emit("app:userSignedIn", { userId: "123" });
```

## Plugin layout

```
/plugins/
  <plugin-id>/
    manifest.json
    index.js
```

## Manifest example

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

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
