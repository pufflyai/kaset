---
title: "@pstdio/kas"
---

# @pstdio/kas

**A simple coding agent for the browser.**

The `@pstdio/kas` package provides a complete browser-based coding agent that can search, read, write, and modify files in an OPFS workspace with user approval gates.

---

## Installation

```bash
npm install @pstdio/kas
```

## Core Features

- **Complete coding agent**: Built on [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks)
- **OPFS integration**: Uses [@pstdio/opfs-utils](/packages/opfs-utils) for file operations
- **Approval gates**: User consent for destructive operations
- **Conversation adapters**: Easy UI integration with streaming responses
- **Shell commands**: Read-only OPFS shell with streaming output

---

## Quick Start

### Basic Agent Setup

```typescript
import { createKasAgent } from "@pstdio/kas";

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: process.env.OPENAI_API_KEY,
  workspaceDir: "/projects/my-app",
  requestApproval: async ({ tool, workspaceDir }) => {
    return confirm(`Allow ${tool} operation in ${workspaceDir}?`);
  },
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

### With Conversation Adapters

```typescript
import { createKasAgent, buildInitialConversation, toConversation } from "@pstdio/kas";

const conversation = [{ id: "1", role: "user", parts: [{ type: "text", text: "Help me build a login form" }] }];

const { initialForAgent, uiBoot, devNote } = await buildInitialConversation(conversation, "/workspace");

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  workspaceDir: "/workspace",
});

// Stream UI-friendly updates
for await (const ui of toConversation(agent(initialForAgent), { boot: uiBoot, devNote })) {
  updateUI(ui);
}
```

---

## Type Exports

Import UI and approval types directly from `@pstdio/kas`:

- `Message`, `UIConversation`, `ToolInvocation`
- `ApprovalRequest`, `RequestApproval`

```ts
import type { Message, UIConversation, ToolInvocation, ApprovalRequest, RequestApproval } from "@pstdio/kas";
```

---

## API Reference

### `createKasAgent(options)`

Creates a new KAS coding agent.

**Options:**

- `model: string` - Model name (e.g., "gpt-5-mini")
- `apiKey: string` - API key
- `workspaceDir: string` - OPFS workspace directory path
- `baseURL?: string` - Custom API base URL
- `requestApproval?: RequestApproval` - Approval callback for destructive operations
- `approvalGatedTools?: string[]` - Tools requiring approval (defaults to a predefined list: writes, deletes, patches, uploads, moves)
- `systemPrompt?: string` - Custom system prompt
- `effort?: "low" | "medium" | "high"` - Reasoning effort level
- `maxTurns?: number` - Maximum conversation turns (default: 100)
- `onShellChunk?: (chunk: string) => void` - Stream chunks from `opfs_shell`
- `dangerouslyAllowBrowser?: boolean` - Allow browser runtime (default: true)
- `extraTools?: Tool[]` - Additional tools to include

**Returns:** Agent function that takes messages and returns streaming responses.

### `buildInitialConversation(conversation, path)`

Prepares a UI conversation for the agent.

**Parameters:**

- `conversation: UIConversation` - Array of UI messages
- `path: string` - Workspace path

**Returns:** Object with `initialForAgent`, `uiBoot`, and `devNote` properties.

### `toConversation(agentStream, { boot, devNote })`

Converts agent responses to UI-friendly format.

**Parameters:**

- `agentStream` - The agent's async generator
- `boot` - Initial UI messages (from `buildInitialConversation`)
- `devNote` - Developer note metadata (from `buildInitialConversation`)

**Returns:** Async generator yielding UI conversation updates.

### `createApprovalGate({ approvalGatedTools?, requestApproval? })`

Creates an approval gate for controlling tool access.

**Parameters:**

- `approvalGatedTools?: string[]` - Tools requiring approval
- `requestApproval?: RequestApproval` - Approval callback used when a gated tool is invoked

**Returns:** Object with `check` method for validating tool usage.

### `defaultSystemPrompt`

The default system prompt string used by the agent. Import to customize or extend:

```ts
import { defaultSystemPrompt } from "@pstdio/kas";
```

---

## Default Approval-Gated Tools

The following tools require user approval by default:

- `opfs_write_file` - Write/create files
- `opfs_delete_file` - Delete files
- `opfs_patch` - Apply patches to files
- `opfs_upload_files` - Upload files to workspace
- `opfs_move_file` - Move/rename files

---

## Built-in Tools

KAS agents come with these OPFS tools:

### File Operations

- **opfs_ls** - List directory contents
- **opfs_read_file** - Read file contents
- **opfs_write_file** ⚠️ - Write/create files
- **opfs_delete_file** ⚠️ - Delete files
- **opfs_patch** ⚠️ - Apply precise patches
- **opfs_move_file** ⚠️ - Move/rename files
- **opfs_upload_files** ⚠️ - Upload files
- **opfs_download** - Trigger a browser download for a workspace file

### Search & Analysis

- **opfs_shell** - Run read-only shell commands (grep, ls, find, etc.) and stream output

⚠️ = Requires approval by default

---

## Examples

### Custom Approval Logic

```typescript
const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  workspaceDir: "/project",
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    // Always allow read operations
    if (tool.includes("read") || tool.includes("list") || tool.includes("shell")) {
      return true;
    }

    // Confirm destructive operations
    return confirm(`Allow ${tool}?\n${JSON.stringify(detail, null, 2)}`);
  },
});
```

### With Custom Tools

```typescript
import { Tool } from "@pstdio/tiny-ai-tasks";

const customTool = Tool(async ({ query }) => ({ messages: [{ role: "tool", content: `Result: ${query}` }] }), {
  name: "search_docs",
  description: "Search documentation",
});

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  workspaceDir: "/project",
  extraTools: [customTool],
});
```

### React Integration

```typescript
const [conversation, setConversation] = useState([]);

async function sendMessage(text: string) {
  const newMessage = { id: uuid(), role: "user", parts: [{ type: "text", text }] };
  const updatedConversation = [...conversation, newMessage];

  const { initialForAgent, uiBoot, devNote } = await buildInitialConversation(updatedConversation, workspaceDir);

  for await (const ui of toConversation(agent(initialForAgent), { boot: uiBoot, devNote })) {
    setConversation(ui);
  }
}
```

---

## Dependencies

- [@pstdio/opfs-utils](/packages/opfs-utils) - OPFS file operations
- [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks) - AI task framework
- [@pstdio/tiny-tasks](/packages/tiny-tasks) - Workflow primitives
- [@pstdio/prompt-utils](/packages/prompt-utils) - Prompt utilities
- `openai` - OpenAI API client

---

## See Also

- [Meet KAS](/concepts/kas) - Conceptual overview
- [Live Playground](https://kaset.dev) - Try KAS in action
- [@pstdio/opfs-utils](/packages/opfs-utils) - Underlying file operations
- [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks) - AI task building blocks
