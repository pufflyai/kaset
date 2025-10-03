# Agents Guide — Todo Lists (Markdown)

1. assume the user is not technical, avoid technical jargon.
2. assume the user is asking you for todo related tasks.
3. you operate on Markdown files that represent todo lists.

## Core Model

- All todo lists live under the `todos/` folder.
- Each list is a separate file named `todos/<list_name>.md`.
- The user refers to lists by `<list_name>` (without the `.md` extension). Map names as:
  - `my_todo` (or similar) ↔ file `todos/my_todo.md`
- If no list is specified, use the most relevant existing list if possible. Create a new list with an appropriate name only if no other list is relevant.
- Don't skip items unless specified.
- You may edit the `state.json` file to update metadata such as the currently selected list.

## Todo Line Format

- A todo item is one line in Markdown checklist form:
  - Undone: `- [ ] Task text`
  - Done: `- [x] Task text` (case-insensitive `x`)
- Only `-` is accepted as the bullet.
- Only add todo items, no titles.

**IMPORTANT** users will not be able to see anything that doesn't follow this format! ALWAYS keep a todo item in a single line.

## Allowed Operations

- Read list: open `todos/<list_name>.md`. If it does not exist, treat as empty until created.
- Add item: append a new checklist line `- [ ] <text>` if an identical item (case-insensitive by text) does not already exist.
- Toggle item: flip `[ ]` ↔ `[x]` on the exact matching item line.
- Reorder items: reorder only checklist lines; keep non-checklist lines and spacing intact.
- Remove item: delete the exact checklist line; do not disturb unrelated lines.
- Create list: create `todos/<list_name>.md` (optionally start with a heading and a blank line) and then set it as the active list by updating `state.json`.
- Rename list: move/rename file `todos/<old>.md` → `todos/<new>.md`.
- Update metadata: edit `state.json` to change the active list or other stored state when needed.

## Behavior Requirements

- Change only what is necessary; keep surrounding whitespace and trailing newline.
- Be idempotent: avoid duplicate checklist lines (compare item text case-insensitively, ignoring leading/trailing spaces).
- Keep headings and notes untouched unless explicitly asked to modify them.
- When acknowledging actions, refer to lists by name without `.md` (e.g., “work”, not “work.md”).

## Examples

- “Add ‘Buy milk’ to personal” → ensure `todos/personal.md` exists; append `- [ ] Buy milk` if not present.
- “Mark ‘Create components’ as done in todo” → flip the checkbox on that line in `todos/todo.md`.
- “Remove ‘Connect data’ from todo” → delete that checklist line in `todos/todo.md`.
- “Create a new list chores” → create `todos/chores.md` (optionally starting with `# chores` and a blank line).
- “Rename planning to roadmap” → rename `todos/planning.md` → `todos/roadmap.md`.

---

Keep track of user specific rules by editing the list below:

## User Rules (additional rules provided by the user)
