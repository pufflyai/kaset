---
title: Quick Start
---

# Quick Start

:::warning
This section is work in progress, the package `@pstdio/kas` doesn't exist yet.
:::

This Quick Start integrates the Kaset Agent (KAS) into your app so it can search, read, and edit files in the browser’s OPFS.

You’ll:

1. Install KAS and OPFS utils
2. Initialize the agent with an OPFS workspace
3. Run your first task
4. Wire a simple UI that updates live

## KAS Installation

```bash
npm i @pstdio/kas @pstdio/opfs-utils @pstdio/tiny-ai-tasks
```

Optional (React helpers):

```bash
npm i @pstdio/opfs-hooks
```

## 1. Initialize the agent

Point KAS at a workspace folder inside OPFS (a sandboxed directory the agent can see/edit). Writes, deletes, patches, uploads, and moves are approval‑gated.

```ts
import { createKasAgent } from "@pstdio/kas";

export const kas = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
  baseURL: "<YOUR_BASE_URL>",
  // The folder in OPFS the agent can see/edit
  workspaceDir: "app/todo",
  // Ask users before first write/patch/delete/upload/move
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    console.log("Needs approval", tool, workspaceDir, detail);
    return true;
  },
});
```

## 2. First run

Ask the agent to scaffold a Markdown todo list. It will use OPFS tools.

```ts
import { mergeStreamingMessages } from "@pstdio/tiny-ai-tasks";

const conversation = [
  {
    role: "user" as const,
    content: "Create a todo list with 5 actionable items",
  },
];

let history: MessageHistory = [];

console.log("Thinking...");

for await (const [newMessages] of kas.run(conversation)) {
  history = mergeStreamingMessages(history, newMessages);
  console.clear();
  console.log(JSON.stringify(history, null, 2));
}
```

## 3. Show files in your UI (React)

`@pstdio/opfs-hooks` keeps components in sync with OPFS changes (both user and agent writes).

```tsx
import { useFolder, useFileContent } from "@pstdio/opfs-hooks";

export function FileExplorer() {
  const { rootNode } = useFolder("app/todo");
  return <pre>{JSON.stringify(rootNode, null, 2)}</pre>;
}

export function TodoViewer() {
  const path = "app/todo/todos/monday.md";
  const { content } = useFileContent(path); // auto‑refreshes when file changes
  return <pre>{content}</pre>;
}
```

## 4. Optional: seed the workspace

If the folder may not exist yet, write once to create it:

```ts
import { writeFile } from "@pstdio/opfs-utils";
await writeFile("app/todo/todos/hello.md", "- [ ] New item\n");
```

### What’s next?

- Explore [`@pstdio/opfs-utils`](/packages/opfs-utils) for search, patching, uploads, and more.
- See the [Playground’s Todo](https://kaset.dev) example.
