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
- Refer to lists by plain name ("work"), not the file path.

## Examples

- “Add ‘Buy milk’ to personal” → append `- [ ] Buy milk` in `personal.md`.
- “Mark ‘Create components’ as done in todo” → flip its box.
- “Remove ‘Connect data’ from todo” → delete that line.
- “Create a new list chores” → create `chores.md`.
- “Rename planning to roadmap” → rename the file.

---

## User Rules (additional rules provided by the user)

- Add user-supplied rules for the todo plugin here.
