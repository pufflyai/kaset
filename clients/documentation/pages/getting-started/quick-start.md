---
title: Quick Start
---

# Quick Start

This Quick Start integrates the Kaset Agent (KAS) into your app so it can search, read, and edit files in the browser’s OPFS.

You’ll:

1. Initialize the agent with an OPFS workspace
2. Build initial conversation and stream UI updates (optional)
3. Auto‑commit changes to your workspace (optional)
4. Show files in React (optional)
5. Seed the workspace (optional)

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
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

const workspaceDir = "/projects/demo";

// Create approval gate for controlling tool access
const approvalGate = createApprovalGate({
  // Optional: customize which tools require approval
  approvalGatedTools: ["opfs_write_file", "opfs_delete_file", "opfs_patch", "opfs_upload_files", "opfs_move_file"],
  // Require permission before the approval gated tool is executed
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    console.log("Needs approval", tool, workspaceDir, detail);
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});

// Create OPFS tools with the workspace directory
const opfsTools = createOpfsTools({
  rootDir: workspaceDir,
  approvalGate,
});

// Create the agent with tools
const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
  tools: opfsTools,
  dangerouslyAllowBrowser: true, // Required for browser environments
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

## 2. Optional: Stream UI-friendly updates

Transform agent responses into UI-friendly format using conversation adapters:

```ts
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { toConversationUI, toBaseMessages } from "@pstdio/kas/kas-ui";

const workspaceDir = "/projects/demo";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool, detail }) => {
    return confirm(`Allow ${tool}?`);
  },
});

const opfsTools = createOpfsTools({ rootDir: workspaceDir, approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "<YOUR_API_KEY>",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});

// Load agent instructions from AGENTS.md in workspace (optional)
const { messages: instructionMessages } = await loadAgentInstructions(workspaceDir);

// Your UI conversation
const uiMessages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Create a todo list with 5 items" }] }];

// Combine instructions with user messages
const allMessages = [...instructionMessages, ...uiMessages];

// Convert to base messages and stream UI updates
for await (const ui of toConversationUI(agent(toBaseMessages(allMessages)))) {
  console.log(ui); // Array of UIMessage objects
  // Update your UI with the conversation
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

## 5. Optional: Seed the workspace

If the folder may not exist yet, write once to create it:

```ts
import { writeFile } from "@pstdio/opfs-utils";
await writeFile("projects/demo/todos/hello.md", "- [ ] New item\n");
```

### What’s next?

- See the [Playground’s Todo](https://kaset.dev) example.
