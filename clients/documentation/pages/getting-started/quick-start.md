---
title: Quick Start
---

# Quick Start

This Quick Start integrates the Kaset Agent (KAS) into your app so it can search, read, and edit files in the browser’s OPFS.

You’ll:

1. Install dependencies
2. Initialize the agent with an OPFS workspace
3. Build initial conversation and stream UI updates
4. Auto‑commit changes to your workspace (optional)
5. Browse files live in React (optional)

## KAS Installation

```bash
npm i @pstdio/kas @pstdio/opfs-utils
```

Optional (React helpers):

```bash
npm i @pstdio/opfs-hooks
```

## 1. Initialize the agent

Point KAS at a workspace folder inside OPFS (a sandboxed directory the agent can see/edit). Writes, deletes, patches, uploads, and moves are approval‑gated by default.

```ts
import { createKasAgent } from "@pstdio/kas";

const workspaceDir = "/projects/demo";

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
  workspaceDir,
  // Optional: customize which tools require approval
  approvalGatedTools: ["opfs_write_file"],
  // Require permission before the approval gated tool in this workspace
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    console.log("Needs approval", tool, workspaceDir, detail);
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

## 2. Optional: Build conversation and stream UI updates

Transform your UI messages into an agent‑ready conversation and stream UI‑friendly updates back.

```ts
import { buildInitialConversation, toConversation } from "@pstdio/kas";

// Your UI conversation (IDs optional but recommended for merges)
const uiConversation = [
  { id: "1", role: "user" as const, parts: [{ type: "text", text: "Create a todo list with 5 items" }] },
];

// Prepare boot messages for the agent and UI
const { initialForAgent, uiBoot, devNote } = await buildInitialConversation(uiConversation, workspaceDir);

// Stream UI‑friendly updates
for await (const ui of toConversation(agent(initialForAgent), { boot: uiBoot, devNote })) {
  console.log(ui);
}
```

## 3. Optional: Auto‑commit changes

Persist edits made by the agent into a Git history inside OPFS.

```ts
import { safeAutoCommit } from "@pstdio/opfs-utils";

await safeAutoCommit({
  dir: workspaceDir,
  message: "AI updates",
  author: { name: "KAS", email: "kas@kaset.dev" },
});
```

## 4. Optional: Show files in React

`@pstdio/opfs-hooks` keeps components in sync with OPFS changes (both user and agent writes).

```tsx
import { useFolder, useFileContent } from "@pstdio/opfs-hooks";

export function FileExplorer() {
  const { rootNode } = useFolder("projects/demo");
  return <pre>{JSON.stringify(rootNode, null, 2)}</pre>;
}

export function TodoViewer() {
  const path = "projects/demo/todos/monday.md";
  const { content } = useFileContent(path); // auto‑refreshes when file changes
  return <pre>{content}</pre>;
}
```

## 4. Optional: seed the workspace

If the folder may not exist yet, write once to create it:

```ts
import { writeFile } from "@pstdio/opfs-utils";
await writeFile("projects/demo/todos/hello.md", "- [ ] New item\n");
```

### What’s next?

- See the [Playground’s Todo](https://kaset.dev) example.
