# Todo Playground Plugin Expansion

## Background

The todo playground demonstrates Kaset's browser-first agent workflow where todos live in Markdown files within OPFS. A minimal plugin runtime already exists (`files/plugins/hello-world`) showing how commands and plugin settings work. We want to expand this surface so multiple plugins can extend the todo workflow (list creation, editing flows, analytics, automation) without modifying the core UI.

## Existing Plugin Model

- **Location**: `/plugins/<plugin-id>/` inside the playground workspace. Each plugin ships a `manifest.json`, an `entry` module, optional assets, and persisted settings.
- **Runtime**: Plugins load through the `kaset-plugin-host`, which validates API compatibility (`manifest.api`), builds a permission-filtered `PluginContext`, calls `activate(ctx)`, and wires declared commands, events, and optional hot-reload support.
- **Settings**: Stored under `/state/public/plugins/<id>.json` and accessed via `ctx.settings.read()` / `ctx.settings.write()` with JSON Schema validation provided by the host.
- **UI Surfaces**: Declarative command palette entries (`manifest.ui.commands`) and optional notifications `ctx.ui.notify(level, message)`.
- **Example**: `hello-world` demonstrates a command (`hello.sayHello`) that reads settings and fires a notification during activation.

## Goals

1. Provide a clear contract for todo-centric extension points (lists, items, metadata, sync state).
2. Standardise host events so plugins can react to list or item changes without filesystem polling.
3. Offer high-level helpers for common mutations (add item, toggle item, create list) with validation.
4. Ship a starter library of plugins to show best practices and dogfood the API.
5. Document tooling for authoring, testing, and debugging plugins in the playground.

## Proposed Plugin Surfaces

### 1. Todo Data API (`ctx.todo`)

Expose a focused API for list and item operations, internally backed by `TodoStore` helpers.

- `ctx.todo.lists(): Promise<string[]>` – fetch ordered list names.
- `ctx.todo.getActiveList(): Promise<{ name: string; items: TodoItem[] }>` – returns current selection.
- `ctx.todo.setActiveList(name: string)` – triggers UI selection and persistence.
- `ctx.todo.addList(name: string)` / `ctx.todo.deleteList(name: string)` – reuse store flows, emit host events.
- `ctx.todo.addItem(text: string)` / `ctx.todo.toggleItem(line: number, done: boolean)` / `ctx.todo.updateItem(line: number, text: string)` – built on existing store logic.
- `ctx.todo.onDidChange(callback)` – subscription with `{ kind: "list" | "item" | "selection"; payload }` events.

### 2. App Event Bridge

Standardise host → plugin events so plugins can observe lifecycle without polling.

- Emit on store transitions (e.g., after `refreshLists`, `selectList`, `addItem`, `saveEditing`).
- Bridge agent actions (e.g., when LLM modifies OPFS files) with `host.emit("todo.fileChanged", { file, reason })`.
- Allow plugins to publish their own events (`ctx.events.emit(name, payload)`) for inter-plugin communication; host mediates to prevent loops.

### 3. UI Integration Hooks

Let plugins enhance UI with lightweight affordances without bundling React code.

- Declarative quick actions: extend the item composer with plugin-provided buttons, each mapped to a plugin command (`manifest.ui.quickActions?: [{ id, title, target: "composer" | "toolbar" }]`).
- Notifications + modal dialogs: extend `ctx.ui` with `ctx.ui.confirm(opts)` to prompt the user for plugin-driven confirmations (host renders a shared modal).
- Settings surface: expose settings schema via the UI so each plugin automatically gets a configurable panel in the playground settings drawer.

### 4. Filesystem Permissions Profiles

Define preset permission bundles to simplify manifests while keeping strict defaults.

- `"todo:read"` → read access to `/todo/todos/**/*.md`.
- `"todo:write"` → write access to `/todo/todos/**/*.md`.
- `"state:public"` → read/write `/state/public/**`.
- Allow manifests to reference profiles (`"permissions": { "profiles": ["todo:read", "todo:write"] }`). The host resolves these to actual globs.

### 5. Testing & Diagnostics

Provide utilities for plugin authors to test in isolation.

- `npm run test:plugins --workspace playground` to spin up a headless plugin host, run `activate`, invoke commands, and assert FS mutations within a temp OPFS mock.
- Add `ctx.log.debug` forwarding to the browser console with plugin-id tags for easier debugging.

## Integration Architecture

- `clients/playground/src/services/plugins/global-plugin-host.ts` will own the shared global host configuration. It aggregates host configs contributed by each example app before constructing `@pstdio/kaset-plugin-host`.
- `clients/playground/src/examples/todo/plugin-host.ts` exports `createHostConfig(store)` which attaches todo-specific behavior (the `ctx.todo` API, event emission, quick actions, and permission profiles). This module is registered with the global host aggregator.
- Additional example apps contribute their own config modules under their respective folders; the global host merges them so commands and settings from every example become available across the playground shell.

## Example Plugin

### Todo Templates

- **Purpose**: Let users define reusable todo list templates that can be applied when creating new lists.
- **Manifest highlights**:
  ```json
  {
    "id": "todo-templates",
    "name": "Todo Templates",
    "api": "^1.0.0",
    "entry": "index.js",
    "permissions": { "profiles": ["todo:read", "todo:write", "state:public"] },
    "ui": {
      "commands": [
        { "id": "templates.apply", "title": "Create List from Template", "category": "Templates" },
        { "id": "templates.save", "title": "Save Current List as Template", "category": "Templates" }
      ],
      "quickActions": [{ "id": "templates.apply", "title": "Use Template", "target": "composer" }]
    },
    "settingsSchema": {
      "type": "object",
      "properties": {
        "templates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "description": { "type": "string" },
              "items": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": { "type": "string" },
                    "done": { "type": "boolean", "default": false }
                  },
                  "required": ["text"]
                }
              }
            },
            "required": ["name", "items"]
          }
        }
      }
    }
  }
  ```
- **Behavior**: Stores template definitions in plugin settings, surfaces them via quick actions when creating a list, and populates new todo files with the template content (including optional descriptions and default completion states).

## Implementation Outline

1. **API Definition**
   - Finalise TypeScript definitions for `TodoPluginContext` (`ctx.todo`, `ctx.events`, new UI helpers).
   - Document permission profiles and add host resolution logic.
   - Update `clients/playground/src/examples/todo/plugin-host.ts` so `createHostConfig` exposes the enhanced context.

2. **Host Enhancements**
   - Wire store events (`refreshLists`, `selectList`, mutations) to host `emit` calls.
   - Implement quick action adapters to surface plugin commands in the UI toolbar/composer.
   - Extend settings panel to render plugin schemas using Chakra UI forms.
   - Update `clients/playground/src/services/plugins/global-plugin-host.ts` to merge the todo config with other example configs before starting the shared host.

3. **Plugin Tooling**
   - Add Vitest-based plugin harness (`npm run test:plugins`).
   - Create logging helpers and developer docs describing debugging workflow.

4. **Example Plugin**
   - Build and ship the `todo-templates` plugin under `/plugins/`.
   - Document usage inside `files/plugins/todo-templates/README.md` with authoring guidance.
   - Dogfood quick actions and template APIs, capture feedback to refine surfaces.

5. **Documentation & QA**
   - Publish updated docs in `clients/documentation/pages/modifications/plugins.md` linking to the todo-specific surfaces.
   - Smoke-test plugin enable/disable flows, permission enforcement, and error handling.
   - Prepare migration guide for existing plugins.

## Next Steps

- Review this spec with the playground maintainers.
- Decide on the minimum lovable subset of `ctx.todo` operations for the first iteration.
- Once approved, begin implementation with the API definition tasks described in Implementation Outline step 1.
