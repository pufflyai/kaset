# Agents Guide

The user has a **demo desktop website** they can expand by _vibecoding_ plugins — small edits in OPFS that hot-reload into visible windows.

- Assume the user is not technical, avoid technical jargon.

## What you can see and edit

### `plugins` folder

- Plugins live under `/plugins/<pluginId>/`.
- Each must contain a `manifest.json` that defines metadata, entry module, and optional settings.
- Plugins can optionally include a `rules.md` file with plugin-specific instructions that live next to the plugin's code.

### `plugin_data` folder

- Use for long-lived plugin data such as serialized state, user-created documents, cached API responses, or generated assets.
- Persistent files live under `/plugin_data/`.
- Store each plugin's state inside `/plugin_data/<pluginId>/` to avoid conflicts.
- Conventionally include files like `state.json`, history logs, and any other artifacts that should survive reloads or restarts.

### Manifests

A valid `manifest.json` must follow the strict schema:

- Required: `"id"`, `"name"`, `"version"`, `"api"`, `"entry"`.
- `id` must **equal** the plugin folder name.
- `"ui.desktop"` is required to make the window.

## Creating Plugins

- When creating editors (e.g. documents, notes, code, images, etc.) their artifacts should live in `/plugin_data/<pluginId>/`, and the plugin should load them via opfs.

## Plugin Example

> Place these files under `/plugins/<pluginId>/`.
> The host will validate and load automatically when the user opens or refreshes the workspace.

### Folder layout

```
/plugins/hello/
  manifest.json
  index.js
  ui/
    window.jsx
```

### `/plugins/hello/manifest.json`

```json
{
  "id": "hello",
  "name": "Hello Plugin",
  "version": "0.1.0",
  "api": "^1.0.0",
  "dependencies": {
    "react": "https://esm.sh/react/es2022/react.mjs",
    "react/jsx-runtime": "https://esm.sh/react/es2022/jsx-runtime.mjs",
    "react-dom/client": "https://esm.sh/react-dom/es2022/client.mjs",
    "react-dom": "https://esm.sh/react-dom/es2022/react-dom.mjs"
  },
  "ui": {
    "desktop": {
      "title": "Hello",
      "description": "A simple window showing a todo list.",
      "singleton": true,
      "defaultSize": { "width": 720, "height": 480 },
      "window": {
        "entry": "ui/window.jsx"
      }
    }
  },
  "commands": [
    {
      "id": "hello.reset",
      "title": "Hello: Reset tasks"
    }
  ],
  "settingsSchema": {
    "type": "object",
    "properties": {
      "todos": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

### `index.js`

```js
export default {
  async activate(ctx) {
    await ctx.api["log.info"]("hello plugin activated");
  },
};
```

### `ui/window.jsx`

```js
import { createRoot } from "react-dom/client";

function Window() {
  return <div>hello world!</div>;
}

export function mount(container) {
  if (!container) throw new Error("mount target is not available");

  const target = container;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(<Window />);

  // Called by the runtime when the window is closed
  return () => root.unmount();
}
```

> Notes:
>
> - `manifest.id` must match the folder name or loading fails.
> - you don't have to use react for the UI

---

## Plugin Rules

Each plugin can define extra guidance in `/plugins/<pluginId>/rules.md`.

- Use this file for plugin-specific behavior, guardrails, and any user-provided rules for that plugin.
- The Todo demo stores its checklist rules in `/plugins/todo/rules.md`; use it as a reference when creating new plugins.
