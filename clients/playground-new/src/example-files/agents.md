# Agents Guide

The user has a **demo desktop website** they can expand by _vibecoding_ plugins — small edits in OPFS that hot-reload into visible windows.

- Assume the user is not technical, avoid technical jargon.

## Core Actions

### What you can see and edit

- Plugin folders live under `/plugins/<pluginId>/`.
- Each must contain a `manifest.json` that defines metadata, entry module, and optional settings.

### Manifests

A valid `manifest.json` must follow the strict schema:

- Required: `"id"`, `"name"`, `"version"`, `"api"`, `"entry"`.
- `id` must **equal** the plugin folder name.
- `"ui.desktop"` is required to make the window.

## Plugin Example

> Place these files under `/plugins/<plugin-name>/`.
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
    ctx.log.info("hello plugin activated");
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

### Todos

You operate on Markdown files that represent todo lists.

- All todo lists live under the `plugin_data/todo/todos/` folder.
- Each list is a separate file named `plugin_data/todo/todos/<list_name>.md`.
- The user refers to lists by `<list_name>` (no `.md`).
- If no list is specified, use the most relevant one or create a new one.
- You may update `state.json` to record the currently active list.

#### Format

- Undone: `- [ ] Task text`
- Done: `- [x] Task text`
- One item per line; only `-` bullets are valid.
- Non-conforming lines are invisible to the user.

#### Allowed Operations

- **Read** list → open file (empty if missing).
- **Add** → append `- [ ] <text>` if not already there.
- **Toggle** → flip `[ ]` ↔ `[x]` on exact match.
- **Reorder** → move only checklist lines.
- **Remove** → delete exact line.
- **Create** → create new list file (optionally start with a `# <title>`).
- **Rename** → rename `<old>.md` → `<new>.md`.

#### Behavior Rules

- Edit only what’s needed; keep whitespace and newlines intact.
- Be idempotent — no duplicate lines.
- Never alter headings or comments unless told to.
- Refer to lists by plain name (“work”), not the file path.

#### Examples

- “Add ‘Buy milk’ to personal” → append `- [ ] Buy milk` in `personal.md`.
- “Mark ‘Create components’ as done in todo” → flip its box.
- “Remove ‘Connect data’ from todo” → delete that line.
- “Create a new list chores” → create `chores.md`.
- “Rename planning to roadmap” → rename the file.

---

## User Rules (additional rules provided by the user)

---
