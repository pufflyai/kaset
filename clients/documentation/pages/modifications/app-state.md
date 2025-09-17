---
title: Application State
---

# Application State

Besides [artifacts](/modifications/artifacts), you can also make application state editable by agents. Allow the agent to e.g. navigate across your app on behalf of the user.

Representing app state as files makes it legible to both users and agents. KAS can propose and apply changes via safe, reviewable patches.

## Why move state into files?

- Files live in the same origin-private file system (OPFS) space as user content, so the agent can read and diff them without custom APIs.
- Users can inspect, back up, or hand-edit JSON state just like any other artifact.
- You get the same conflict management that powers artifact editing (patch review, previews, etc.).
- Agents see the same snapshot the UI does, so they can explain "where you are" or what's selected before they take action.

Keep the file format small and explicit. Prefer JSON objects that mirror the minimal state you need the agent to touch.

## Example: Application State in the Playground

```text
examples/todo/
├── todos/           # markdown artifacts (one file per todo list)
├── state.json       # lightweight UI state shared with the agent
└── agents.md        # the agent guide that grants edit permissions
```

In the playground, the UI stores the currently selected list inside `todo/state.json`:

```json
{
  "selectedList": "personal.md"
}
```

The store binds to that file using `@pstdio/opfs-utils` and `@pstdio/opfs-hooks`:

```ts
useOpfsStoreBinding({
  store: adapter,
  storageOptions,
  bindOptions,
});
```

- `useOpfsSync(store)` wraps `bindStoreToJsonFile`, keeping the local store in sync with `todo/state.json`.
- A directory watcher reacts to Markdown changes and refreshes the in-memory state when files move or update.
- The agent guide (`agents.md`) explicitly allows editing `todo/state.json`, so the agent can mark newly created lists as active and describe the current list to the user.

## Implementation checklist

1. **Pick a path** under your project root (for example `my-app/state.json`).
2. **Define the schema** for fields agents can touch (selected view, filter, user preferences, etc.).
3. **Bind your runtime store** to the file with `bindStoreToJsonFile` or the `useOpfsStoreBinding` hook.
4. **Document agent permissions** in your `agents.md` so the agent knows it may read and write the state file.
5. **Watch relevant directories** (`watchDirectory`) if external changes should refresh the UI.
