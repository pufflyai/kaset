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
- **Shell commands**: Safe OPFS command execution

---

## Quick Start

### Basic Agent Setup

```typescript
import { createKasAgent } from "@pstdio/kas";

const agent = createKasAgent({
  model: "gpt-4",
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
import { 
  createKasAgent, 
  buildInitialConversation, 
  toConversation 
} from "@pstdio/kas";

const conversation = [
  { id: "1", role: "user", parts: [{ type: "text", text: "Help me build a login form" }] }
];

const { initialForAgent, uiBoot } = await buildInitialConversation(
  conversation, 
  "/workspace"
);

const agent = createKasAgent({
  model: "gpt-4",
  apiKey: "your-key",
  workspaceDir: "/workspace",
});

// Stream UI-friendly updates
for await (const ui of toConversation(agent(initialForAgent), { boot: uiBoot })) {
  updateUI(ui);
}
```

---

## API Reference

### `createKasAgent(options)`

Creates a new KAS coding agent.

**Options:**

- `model: string` - OpenAI model name (e.g., "gpt-4")
- `apiKey: string` - OpenAI API key
- `workspaceDir: string` - OPFS workspace directory path
- `baseURL?: string` - Custom OpenAI API base URL
- `requestApproval?: RequestApproval` - Approval callback for destructive operations
- `approvalGatedTools?: string[]` - Tools requiring approval (defaults to write operations)
- `systemPrompt?: string` - Custom system prompt
- `effort?: "low" | "medium" | "high"` - Reasoning effort level
- `maxTurns?: number` - Maximum conversation turns (default: 100)
- `extraTools?: Tool[]` - Additional tools to include

**Returns:** Agent function that takes messages and returns streaming responses.

### `buildInitialConversation(conversation, path)`

Prepares a UI conversation for the agent.

**Parameters:**
- `conversation: UIConversation` - Array of UI messages
- `path: string` - Workspace path

**Returns:** Object with `initialForAgent`, `uiBoot`, and `devNote` properties.

### `toConversation(agentStream, options)`

Converts agent responses to UI-friendly format.

**Parameters:**
- `agentStream` - The agent's async generator
- `options.boot?` - Initial UI messages
- `options.devNote?` - Developer note metadata

**Returns:** Async generator yielding UI conversation updates.

### `createApprovalGate(requestApproval?, needsApproval?)`

Creates an approval gate for controlling tool access.

**Parameters:**
- `requestApproval?: RequestApproval` - Approval callback
- `needsApproval?: string[]` - Tools requiring approval

**Returns:** Object with `check` method for validating tool usage.

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
- **opfs_list** - List directory contents
- **opfs_read_file** - Read file contents
- **opfs_write_file** ⚠️ - Write/create files
- **opfs_delete_file** ⚠️ - Delete files
- **opfs_patch** ⚠️ - Apply precise patches
- **opfs_move_file** ⚠️ - Move/rename files
- **opfs_upload_files** ⚠️ - Upload files

### Search & Analysis
- **opfs_grep** - Search file contents
- **opfs_shell** - Run read-only shell commands

⚠️ = Requires approval by default

---

## Examples

### Custom Approval Logic

```typescript
const agent = createKasAgent({
  model: "gpt-4",
  apiKey: "your-key",
  workspaceDir: "/project",
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    // Always allow read operations
    if (tool.includes("read") || tool.includes("list") || tool.includes("grep")) {
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

const customTool = Tool(
  async ({ query }) => ({ messages: [{ role: "tool", content: `Result: ${query}` }] }),
  { name: "search_docs", description: "Search documentation" }
);

const agent = createKasAgent({
  model: "gpt-4", 
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
  
  const { initialForAgent, uiBoot } = await buildInitialConversation(
    updatedConversation, 
    workspaceDir
  );
  
  for await (const ui of toConversation(agent(initialForAgent), { boot: uiBoot })) {
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