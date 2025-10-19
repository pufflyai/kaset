---
title: Agent Behavior
---

# Agent Behavior

You can specify how agents behaves in your webapp by dropping an `agents.md` file into your webapp's filesystem. This file acts like a guidebook for the agent: it describes assumptions, constraints, and rules for how it should interact with your app’s files. Because it’s just Markdown, it’s easy to version, review, and share—much like documentation.

Example `agents.md` from the playground:

```md
# Agents Guide

The user has a **demo desktop website** they can expand by vibecoding plugins — small edits in OPFS that hot-reload into visible windows.

- Assume the user is not technical, avoid technical jargon.

## What you can see and edit

- Plugins live under `/plugins/<pluginId>/`.
- Each plugin needs a `manifest.json` that defines metadata and entry modules.
- Persistent data lives under `/plugin_data/<pluginId>/`.
- Plugins can optionally include a `rules.md` file with plugin-specific instructions that live beside the plugin code.

## Plugin Instructions

Each plugin can define extra guidance in `/plugins/<pluginId>/rules.md`.

- Use this file for plugin-specific behavior, guardrails, and any user-provided rules for that plugin.
- The Todo demo stores its checklist rules in `/plugins/todo/rules.md`; use it as a reference when creating new plugins.
```

Example `/plugins/todo/rules.md` from the playground:

```md
# Todo Plugin Rules

You operate on Markdown files that represent todo lists for this plugin.

## Workspace Layout

- All todo lists live under the `plugin_data/todo/` folder.
- Each list is a separate file named `plugin_data/todo/<list_name>.md`.
- The user refers to lists by `<list_name>` (without `.md`).
- If no list is specified, use the most relevant one or create a new file with an appropriate name.
- You may update `state.json` to record the currently active list.

## Format

- Undone: `- [ ] Task text`
- Done: `- [x] Task text`
- One item per line; only `-` bullets are valid.
- Non-conforming lines are invisible to the user.

## Allowed Operations

- **Read** list → open file (empty if missing).
- **Add** → append `- [ ] <text>` if not already present.
- **Toggle** → flip `[ ]` ↔ `[x]` on the exact matching line.
- **Reorder** → move only checklist lines.
- **Remove** → delete the exact line.
- **Create** → create new list file (optionally start with a `# <title>`).
- **Rename** → rename `<old>.md` → `<new>.md`.

## Behavior Requirements

- Edit only what’s needed; keep whitespace and newlines intact.
- Be idempotent — avoid duplicate lines.
- Never alter headings or comments unless told to.
- Refer to lists by plain name (“work”), not the file path.

## Examples

- “Add ‘Buy milk’ to personal” → append `- [ ] Buy milk` in `personal.md`.
- “Mark ‘Create components’ as done in todo” → flip its box.
- “Remove ‘Connect data’ from todo” → delete that line.
- “Create a new list chores” → create `chores.md`.
- “Rename planning to roadmap” → rename the file.

---

## User Rules (additional rules provided by the user)

- Add user-supplied rules for the todo plugin here.
```

Keep track of user specific rules by editing the `## User Rules` section inside the relevant plugin's `rules.md` file.

## User Rules

Users can also save custom rules for the agent to follow. Append them to the plugin-specific `rules.md` so the guidance travels with the plugin.

<div style="position: relative; padding-bottom: 53.541666666666664%; height: 0;"><iframe src="https://www.loom.com/embed/4c66ddf3d17e457f99174eb2f2f66afc?sid=20c357bf-c173-4dfb-ac61-cd53e3710e66" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

User Prompt

```md
add a rule: grocery lists should never have duplicates
```

Example Rules after the update:

```md
...

## User Rules (additional rules provided by the user)

- grocery list items should always have a unit (use metric for quantities)
- grocery lists should never have duplicates
```
