---
title: Artifacts
---

# Artifacts

Artifacts are the **outputs** your users create inside your app — such as a slide deck, document, or table — that both the agent and the app can co-create and edit. By treating artifacts as files, you unlock powerful capabilities like search, diffs, and safe patching.

## Why model artifacts as files?

- Agents and the UI see the exact same content because everything lives in the browser's Origin Private File System (OPFS).
- You can diff, patch, and version artifacts with the same workflows you already use for source code.
- Files can be exported, hand-edited, or restored from history without custom tooling.
- Agents gain "under the hood" context (headings, metadata, structure) without additional APIs or SDKs.

## Example: Artifacts in the Playground

The playground ships with a todo app to illustrate how artifacts behave when they are just files.

### Directory layout

```text
examples/todo/files/
├── todos/           # markdown artifacts (one file per todo list)
└── agents.md        # the agent guide that grants edit permissions
```

Each file under `todos/` is a standalone artifact (`shopping.md`, `work.md`, etc.). Users edit them through the UI, while the agent reads and patches the very same files.

### Coordinated edits

1. The UI loads `todos/shopping.md` into a custom editor.
2. An agent uses tools like `ls`, `readFile`, and `patch` to inspect and modify that file.
3. Both sides subscribe to file changes (via `watchDirectory` in the playground), so edits appear instantly without rebuilding state.

### Example: Marking a task complete

When the user asks "mark ‘A unicorn’ as done in shopping", the agent proposes a patch:

```diff
--- a/todos/shopping.md
+++ b/todos/shopping.md
@@
-- [ ] A unicorn
+- [x] A unicorn
```

The playground surfaces this patch for review. Accepting it updates the Markdown artifact, and the UI re-renders the checklist with the new state.

### Example: Creating a new list

Agents can also create new artifact files. Asking for “start a groceries list with Eggs and Milk” results in creating a `todos/groceries.md` file.

## Building your own artifacts

When you turn your app’s outputs into artifacts, follow the same pattern:

1. **Pick a path** for each artifact type (e.g., `reports/<slug>.md`, `boards/<id>.json`).
2. **Document the schema** in your `agents.md` so agents know how to edit it safely.
3. **Record agent permissions** in the same guide ("may edit `reports/**/*.md`", "may create `boards/<id>.json`") so KAS can confidently propose patches to those files.
4. **Keep the UI in sync** by wiring file subscriptions (`watchDirectory`, `useOpfsFile`) so agent edits instantly refresh editors, previews, or tables.
5. **Expose artifacts in the interface**—render a gallery, list, or tabs sourced directly from the OPFS paths so users and agents always act on the same files.
