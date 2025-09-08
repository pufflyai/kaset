---
title: Quick Start
---

# Quick Start

This Quick Start integrates the Kaset Agent (KAS) into your app so it can search, read, and edit files in the browser’s OPFS.

You’ll:

1. Install KAS and OPFS utils
2. Initialize the agent with an OPFS workspace
3. Run your first task
4. Wire a simple UI that updates live

## KAS Installation

Use npm (Node 22+):

```bash
npm i @pstdio/kas @pstdio/opfs-utils
```

Optional (React helpers):

```bash
npm i @pstdio/opfs-hooks
```

## Check OPFS support

```ts
const hasOPFS = typeof navigator !== "undefined" && !!(navigator.storage && (navigator.storage as any).getDirectory);
if (!hasOPFS) throw new Error("OPFS not available in this browser");
```

See Supported Browsers for details.

## 1) Initialize the agent

Point KAS at a workspace folder inside OPFS (a sandboxed directory the agent can see/edit). Writes, deletes, patches, uploads, and moves are approval‑gated.

```ts
import { createKasAgent } from "@pstdio/kas"; // concept package

export const kas = createKasAgent({
  model: "gpt-4o-mini", // or your provider
  apiKey: "<YOUR_API_KEY>",
  // The folder in OPFS the agent can see/edit
  workspaceDir: "app/todo",
  // Ask users before first write/patch/delete/upload/move
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    console.log("Needs approval", tool, workspaceDir, detail);
    return true; // show a modal in real apps
  },
});
```

## 2) First run

Ask the agent to scaffold a Markdown todo list. It uses OPFS tools (`opfs_ls`, `opfs_grep`, `opfs_read_file`, `opfs_write_file`, `opfs_patch`, etc.).

```ts
await kas.run("Create app/todo/todos/monday.md with 5 actionable items in markdown checkboxes");
```

## 3) Show files in your UI (React)

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

## 4) Optional: seed the workspace

If the folder may not exist yet, write once to create it:

```ts
import { writeFile } from "@pstdio/opfs-utils";
await writeFile("app/todo/todos/hello.md", "- [ ] New item\n");
```

### What’s next?

- Explore `@pstdio/opfs-utils` for search, patching, uploads, and more.
- See the [Playground’s Todo](https://kaset.dev) example.
- Add cloud sync with `@pstdio/opfs-sync` when you’re ready.
