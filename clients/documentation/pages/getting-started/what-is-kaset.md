---
title: What is Kaset
---

# What is Kaset?

**Kaset** is an open-source toolkit for adding coding agents to your web apps, client-side.

**Kaset** has a few core goals:

1. Provide tools for working with file systems directly in the browser. Think `ls`, `grep`, etc. Check out [@pstdio/opfs-utils](/packages/opfs-utils) for more details.
2. Deliver a coding agent that runs natively in the browser. Most existing solutions only work server-side. See [Meet KAS](/concepts/kas).
3. Offer tools to help you synchronize your application with OPFS — whether it’s [artifacts](/concepts/artifacts), [application state](/concepts/app-state), or even your [UI](/concepts/ui).
4. Provide tools for tracking and controlling edits, with authorization gates and version control. So that every agent action remains auditable, and reversible.

## Your app as a Filesystem

You can expose your app’s functionality to agents in many ways — APIs, tool catalogs, or protocols like MCP. These work well for clear, well-defined actions.

But when tasks get fuzzier (like creating a theme, modding a UI, or building plugins) managing dozens of specialized tools quickly breaks down.

A filesystem model gives agents a simpler, more flexible interface:

- Agents are already good at reading, searching, and editing files to build the context they need.
- Open-ended requests are easier to express as file edits than as rigid tools.
- Kaset’s approach: model your app as files (state, config, UI, artifacts), and let agents work directly with them. Use MCP or tools for the few things that files can’t capture.

Example project structure from the playground:

```
.
├── agents.md
└── todos/
    ├── todo1.md
    └── todo2.md
```

Still unclear? Check out [Your app as a filesystem](/concepts/filesystem)

## Modifying agent behavior

You can tweak how an agent behaves by dropping an agents.md file into your project. This file acts like a guidebook for the agent: it describes assumptions, constraints, and rules for how it should interact with your app’s files. Because it’s just Markdown, it’s easy to version, review, and share—much like documentation.

Example `agents.md` from the playground:

```md
# Agent Guide — Todo Lists

## Behavior assumptions

1. Assume the user is not technical; avoid jargon.
2. Assume the user is asking for todo-related tasks.
3. Operate exclusively on Markdown files that represent todo lists.

## Core model

- All todo lists live under the `todos/` folder.
- Each list is a separate file named `todos/<list_name>.md`.
- Users refer to lists by `<list_name>` (without the `.md`).
- If no list is specified, default to `todo` (`todos/todo.md`).

## Todo line format

- Undone: `- [ ] Task text`
- Done: `- [x] Task text` (`x` is case-insensitive)
- Preserve non-matching lines (headings, notes, blanks).
- Keep todo items on a single line.

## Allowed operations

- **Read list:** open file; treat as empty if missing.
- **Add item:** append `- [ ] <text>` if not already present.
- **Toggle item:** flip `[ ]` ↔ `[x]`.
- **Reorder items:** reorder only checklist lines.
- **Remove item:** delete the exact line.
- **Create list:** make a new `todos/<list_name>.md`.
- **Rename list:** move/rename the file.

## Behavior requirements

- Change only what’s necessary.
- Be idempotent: no duplicate items.
- Keep headings/notes untouched unless asked.
- Refer to lists without `.md` (e.g., say “work,” not “work.md”).

## Examples

- “Add ‘Buy milk’ to personal” → `todos/personal.md` gets `- [ ] Buy milk`.
- “Mark ‘Create components’ as done in todo” → toggle in `todos/todo.md`.
- “Remove ‘Connect data’ from todo” → delete that line in `todos/todo.md`.
- “Create a new list chores” → create `todos/chores.md` with heading.
- “Rename planning to roadmap” → move `todos/planning.md` → `todos/roadmap.md`.
```

## Benefits

1. **Plug-and-play agents**
   Because your app is modeled as a filesystem (state/config/UI as files), any capable coding agent can read, search, and edit those files. You can drop in, swap, or upgrade agents without redesigning tool APIs—they already know how to operate in this environment.

2. **Cheaper compute (no VMs in the cloud)**
   Running agents locally avoids paying for dedicated servers or virtual machines. Your users’ browsers and devices handle the heavy lifting, dramatically lowering operational costs.

3. **Cheaper token use (LLMs on the user’s machine)**
   If the model runs locally (e.g., via WebGPU or WASM), no tokens need to be sent to a hosted LLM service.

4. **More customizable**
   Each user can tune, extend, or even fork the agent to match their workflow without waiting for centralized updates. This unlocks personalization that server-side solutions struggle to provide.

5. **Unlocks new capabilities for your web app**
   Client-side agents can directly interact with the app’s state, UI, and files, enabling things like real-time UI mods, local-first plugins, offline workflows, or personalized dashboards.

## Downsides

1. **App restructuring required**
   To get the most out of Kaset, you’ll likely need to reshape parts of your app into a file-based model (state, config, UI as files). This adds upfront design work.

2. **Transparent prompts**
   Because the agent runs fully in the browser, its system prompt and instructions are visible to the user. This limits use cases where you want hidden or proprietary agent logic.

3. **User-side persistence**
   State lives in the user’s storage (e.g., OPFS). This can make syncing across devices or accounts more complex compared to a centralized backend.

---

Still unclear? Check out [our playground](https://kaset.dev).
