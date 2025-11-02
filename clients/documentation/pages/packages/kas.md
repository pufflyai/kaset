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
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

const workspaceDir = "/projects/my-app";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool, workspaceDir }) => {
    return confirm(`Allow ${tool} operation in ${workspaceDir}?`);
  },
});

const opfsTools = createOpfsTools({
  rootDir: workspaceDir,
  approvalGate,
});

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: process.env.OPENAI_API_KEY,
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});

// Run agent with messages
const messages = [{ role: "user", content: "Create a simple React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

### With Conversation Adapters

```typescript
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { toConversationUI, toBaseMessages } from "@pstdio/kas/kas-ui";

const workspaceDir = "/workspace";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool }) => confirm(`Allow ${tool}?`),
});

const opfsTools = createOpfsTools({ rootDir: workspaceDir, approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});

// Load instructions and prepare messages
const { messages: instructions } = await loadAgentInstructions(workspaceDir);
const uiMessages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Help me build a login form" }] }];
const allMessages = [...instructions, ...uiMessages];

// Stream UI-friendly updates
for await (const ui of toConversationUI(agent(toBaseMessages(allMessages)))) {
  updateUI(ui);
}
```

---

## Type Exports

Import types from the appropriate packages:

**From `@pstdio/kas`:**
- `Tool` - Tool type from tiny-ai-tasks
- `ApprovalRequest`, `RequestApproval`, `ApprovalGate` - Approval system types

**From `@pstdio/kas/kas-ui`:**
- `UIMessage`, `UIConversation` - UI message types
- `ToolInvocation` - Tool invocation type  
- `TextUIPart`, `ReasoningUIPart`, `ToolInvocationUIPart` - UI part types

**From `@pstdio/kas/opfs-tools`:**
- `AgentInstructions` - Agent instructions type
- `CreateOpfsToolsOptions` - OPFS tools configuration type

```ts
import type { Tool, ApprovalRequest, RequestApproval } from "@pstdio/kas";
import type { UIMessage, UIConversation, ToolInvocation } from "@pstdio/kas/kas-ui";
import type { AgentInstructions } from "@pstdio/kas/opfs-tools";
```

---

## API Reference

### `createKasAgent(options)`

Creates a new KAS coding agent.

**Options:**

- `model: string` - Model name (e.g., "gpt-5-mini")
- `apiKey?: string` - API key for the LLM provider
- `baseURL?: string` - Custom API base URL (required if no apiKey)
- `tools?: Tool[]` - Array of tools for the agent (typically created with `createOpfsTools`)
- `systemPrompt?: string` - Custom system prompt (defaults to KAS system prompt)
- `reasoning?: { effort: "low" | "medium" | "high" }` - Reasoning effort level
- `maxTurns?: number` - Maximum conversation turns (default: 100)
- `dangerouslyAllowBrowser?: boolean` - Allow browser runtime (default: false, set to true for browser use)

**Returns:** Agent function that takes messages and returns streaming responses.

**Example:**

```typescript
const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
  maxTurns: 50,
});
```

### `createApprovalGate({ approvalGatedTools?, requestApproval? })`

Creates an approval gate for controlling tool access.

**Parameters:**

- `approvalGatedTools?: string[]` - Tools requiring approval (default: `["opfs_write_file", "opfs_delete_file", "opfs_patch", "opfs_upload_files", "opfs_move_file"]`)
- `requestApproval?: RequestApproval` - Approval callback used when a gated tool is invoked

**Returns:** Object with `check` method for validating tool usage.

**Example:**

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_write_file", "opfs_delete_file"],
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});
```

### `createOpfsTools({ rootDir, approvalGate })`

Creates OPFS file operation tools for the agent.

**Parameters:**

- `rootDir: string` - Root directory for OPFS operations
- `approvalGate: ApprovalGate` - Approval gate instance

**Returns:** Array of Tool instances for OPFS operations.

**Example:**

```typescript
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

const opfsTools = createOpfsTools({
  rootDir: "/workspace",
  approvalGate,
});
```

### `loadAgentInstructions(rootDir)`

Loads agent instructions from `AGENTS.md` or `agents.md` in the workspace.

**Parameters:**

- `rootDir: string` - Workspace root directory

**Returns:** Promise resolving to `{ messages: UIConversation, agentsPath: string | null }`

**Example:**

```typescript
import { loadAgentInstructions } from "@pstdio/kas/opfs-tools";

const { messages, agentsPath } = await loadAgentInstructions("/workspace");
// messages contains system instructions if AGENTS.md exists
```

### `toConversationUI(agentStream)`

Converts agent responses to UI-friendly format.

**Parameters:**

- `agentStream` - The agent's async generator

**Returns:** Async generator yielding UI conversation updates (array of `UIMessage` objects).

**Example:**

```typescript
import { toConversationUI } from "@pstdio/kas/kas-ui";

for await (const uiMessages of toConversationUI(agent(messages))) {
  setConversation(uiMessages); // Update UI
}
```

### `toBaseMessages(uiMessages)`

Converts UI messages to base messages for the agent.

**Parameters:**

- `uiMessages: UIMessage[]` - Array of UI messages

**Returns:** Array of base messages compatible with the agent.

**Example:**

```typescript
import { toBaseMessages } from "@pstdio/kas/kas-ui";

const baseMessages = toBaseMessages(uiMessages);
for await (const response of agent(baseMessages)) {
  // Process response
}
```

### `systemPrompt`

The default system prompt string used by the agent. Import to customize or extend:

```ts
import { systemPrompt } from "@pstdio/kas";

const customPrompt = systemPrompt + "\n\nAdditional instructions: Focus on TypeScript best practices.";
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
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    // Always allow read operations
    if (tool.includes("read") || tool.includes("ls") || tool.includes("shell")) {
      return true;
    }

    // Confirm destructive operations
    return confirm(`Allow ${tool}?\n${JSON.stringify(detail, null, 2)}`);
  },
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});
```

### With Custom Tools

```typescript
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";
import { Tool } from "@pstdio/tiny-ai-tasks";

const customTool = Tool(
  async ({ query }) => ({ messages: [{ role: "tool", content: `Result: ${query}` }] }),
  {
    name: "search_docs",
    description: "Search documentation",
  }
);

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool }) => confirm(`Allow ${tool}?`),
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: [...opfsTools, customTool],
  dangerouslyAllowBrowser: true,
});
```

### React Integration

```typescript
import { useState } from "react";
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { toConversationUI, toBaseMessages } from "@pstdio/kas/kas-ui";

const [conversation, setConversation] = useState([]);

async function sendMessage(text: string) {
  const newMessage = { id: uuid(), role: "user", parts: [{ type: "text", text }] };
  const updatedConversation = [...conversation, newMessage];

  const { messages: instructions } = await loadAgentInstructions(workspaceDir);
  const allMessages = [...instructions, ...updatedConversation];

  for await (const ui of toConversationUI(agent(toBaseMessages(allMessages)))) {
    setConversation(ui);
  }
}
```

---

## Advanced Patterns

### Streaming with Tool Invocations

Track individual tool calls as they execute:

```typescript
for await (const response of agent(messages)) {
  if (response.role === "assistant" && response.tool_calls) {
    console.log("Agent is calling tools:", response.tool_calls);
  }
}
```

### Custom Error Handling

Wrap the agent to catch and handle errors gracefully:

```typescript
async function* safeAgent(messages) {
  try {
    for await (const response of agent(messages)) {
      yield response;
    }
  } catch (error) {
    yield {
      role: "assistant",
      content: `Error: ${error.message}. Please try rephrasing your request.`,
    };
  }
}
```

### Multi-Workspace Agents

Create separate agents for different workspaces:

```typescript
function createWorkspaceAgent(workspaceDir: string) {
  const approvalGate = createApprovalGate({
    requestApproval: async ({ tool }) => confirm(`Allow ${tool}?`),
  });

  const opfsTools = createOpfsTools({ rootDir: workspaceDir, approvalGate });

  return createKasAgent({
    model: "gpt-5-mini",
    apiKey: "your-key",
    tools: opfsTools,
    dangerouslyAllowBrowser: true,
  });
}

const agents = {
  "/projects/app": createWorkspaceAgent("/projects/app"),
  "/projects/docs": createWorkspaceAgent("/projects/docs"),
};

// Use the appropriate agent based on context
const currentAgent = agents[currentWorkspace];
```

### Conditional Tool Access

Dynamically enable/disable tools based on user permissions:

```typescript
const approvalGatedTools = user.isPremium
  ? ["opfs_write_file"]
  : ["opfs_write_file", "opfs_delete_file", "opfs_patch"];

const approvalGate = createApprovalGate({
  approvalGatedTools,
  requestApproval: async (req) => {
    if (!user.isPremium && req.tool === "opfs_delete_file") {
      return false; // Block for free users
    }
    return confirm(`Allow ${req.tool}?`);
  },
});

const opfsTools = createOpfsTools({ rootDir: "/workspace", approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});
```

### Agent Instructions from OPFS

Load custom instructions dynamically from the workspace:

```typescript
import { loadAgentInstructions } from "@pstdio/kas/opfs-tools";

const { messages: instructionMessages } = await loadAgentInstructions(workspaceDir);

// instructionMessages will contain content from AGENTS.md or agents.md if found
const allMessages = [...instructionMessages, ...userMessages];

for await (const response of agent(allMessages)) {
  console.log(response);
}
```

---

## Best Practices

### 1. Always Gate Destructive Operations

Never allow writes, deletes, or patches without user approval:

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_write_file", "opfs_delete_file", "opfs_patch", "opfs_upload_files", "opfs_move_file"],
  requestApproval: async ({ tool, detail }) => {
    // Show user exactly what will be changed
    return confirm(`Allow ${tool}?\n\n${JSON.stringify(detail, null, 2)}`);
  },
});

const opfsTools = createOpfsTools({ rootDir: "/workspace", approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});
```

### 2. Provide Clear System Prompts

Customize the system prompt to match your use case:

```typescript
const customPrompt = `You are a helpful coding assistant for a React application.
Focus on creating clean, maintainable components following React best practices.
Always use TypeScript and functional components with hooks.`;

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  systemPrompt: customPrompt,
  dangerouslyAllowBrowser: true,
});
```

### 3. Set Appropriate Turn Limits

Prevent infinite loops by setting reasonable turn limits:

```typescript
const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  maxTurns: 20, // Prevent runaway conversations
  dangerouslyAllowBrowser: true,
});
```

### 4. Use Reasoning Effort Wisely

Choose the right reasoning level for your task:

```typescript
// For complex tasks requiring deep analysis
const complexAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  reasoning: { effort: "high" },
  dangerouslyAllowBrowser: true,
});

// For quick, simple tasks
const simpleAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  reasoning: { effort: "low" },
  dangerouslyAllowBrowser: true,
});
```

---

## Troubleshooting

### Agent Not Responding

**Problem:** Agent stream doesn't yield any responses.

**Solutions:**

1. Verify your API key is valid
2. Check network connectivity
3. Ensure workspaceDir exists in OPFS
4. Check browser console for errors

```typescript
// Add error handling
try {
  for await (const response of agent(messages)) {
    console.log(response);
  }
} catch (error) {
  console.error("Agent error:", error);
}
```

### Approval Not Triggering

**Problem:** `requestApproval` callback is never called.

**Solutions:**

1. Verify the tool is in `approvalGatedTools` list in the approval gate
2. Ensure `requestApproval` is properly defined
3. Check that the agent is actually calling the tool

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_write_file"], // Must include the tool
  requestApproval: async (req) => {
    console.log("Approval requested:", req); // Debug log
    return confirm(`Allow ${req.tool}?`);
  },
});

const opfsTools = createOpfsTools({ rootDir: "/workspace", approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});
```

### Files Not Found in OPFS

**Problem:** Agent reports files don't exist.

**Solutions:**

1. Verify the workspace path is correct
2. Check that files were actually written to OPFS
3. Use `@pstdio/opfs-utils` to inspect OPFS directly

```typescript
import { ls, readFile } from "@pstdio/opfs-utils";

// Check what's actually in OPFS
const files = await ls("/workspace");
console.log("Workspace contents:", files);

// Try reading a specific file
try {
  const content = await readFile("/workspace/example.txt");
  console.log("File exists:", content);
} catch (error) {
  console.log("File not found");
}
```

### Streaming Stops Prematurely

**Problem:** Agent stream ends before completing the task.

**Solutions:**

1. Increase `maxTurns` limit
2. Check for API rate limits
3. Verify model supports the requested features

```typescript
const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  maxTurns: 100, // Increase if needed
  dangerouslyAllowBrowser: true,
});
```

### Tool Invocation Errors

**Problem:** Tools fail with unexpected errors.

**Solutions:**

1. Check tool input format matches expected schema
2. Verify workspace permissions
3. Ensure OPFS is available in the browser

```typescript
// Check browser support
if (!navigator.storage?.getDirectory) {
  console.error("OPFS not supported in this browser");
}
```

---

## Performance Tips

### 1. Minimize Workspace Size

Keep workspaces focused and small for faster operations:

```typescript
// Good: Focused workspace
const workspace = "/projects/component-library";

// Avoid: Large, unfocused workspace
const workspace = "/"; // Too broad
```

### 2. Use Efficient Tool Combinations

Combine operations to reduce round trips:

```typescript
// Instead of multiple read_file calls, use opfs_shell with grep
// The agent can run: opfs_shell({ command: "rg 'pattern' --files-with-matches" })
```

### 3. Cache Agent Instances

Reuse agent instances instead of recreating:

```typescript
// Good: Create once, reuse
const agent = createKasAgent({ model: "gpt-5-mini", apiKey: "key", workspaceDir: "/workspace" });

async function handleMessage(text: string) {
  for await (const response of agent([{ role: "user", content: text }])) {
    // Process response
  }
}

// Avoid: Creating new agent each time
async function handleMessage(text: string) {
  const agent = createKasAgent({ ... }); // Wasteful
  // ...
}
```

### 4. Stream Processing

Process responses as they arrive instead of buffering:

```typescript
// Good: Stream processing
for await (const response of agent(messages)) {
  updateUI(response); // Update immediately
}

// Avoid: Buffering all responses
const responses = [];
for await (const response of agent(messages)) {
  responses.push(response);
}
updateUI(responses); // Delayed update
```

---

## Common Use Cases

### Code Review Agent

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: [], // Read-only, no approvals needed
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const reviewAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  systemPrompt: `You are a code review assistant. Review code for:
- Best practices
- Potential bugs
- Performance issues
- Security vulnerabilities
Provide constructive feedback.`,
  dangerouslyAllowBrowser: true,
});

const messages = [{ role: "user", content: "Review the code in src/components/" }];
for await (const response of reviewAgent(messages)) {
  console.log(response);
}
```

### Documentation Generator

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_write_file"],
  requestApproval: async ({ tool, detail }) => {
    if (tool === "opfs_write_file" && detail?.file?.endsWith(".md")) {
      return confirm(`Create documentation: ${detail.file}?`);
    }
    return false;
  },
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const docsAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  systemPrompt: "Generate clear, comprehensive documentation with examples.",
  dangerouslyAllowBrowser: true,
});
```

### Refactoring Assistant

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_patch", "opfs_move_file"],
  requestApproval: async ({ tool, detail }) => {
    return confirm(`Allow ${tool}?\n${JSON.stringify(detail, null, 2)}`);
  },
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const refactorAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  systemPrompt: "Help refactor code while maintaining functionality and tests.",
  reasoning: { effort: "high" }, // Deep analysis for refactoring
  dangerouslyAllowBrowser: true,
});
```

### Test Generator

```typescript
const approvalGate = createApprovalGate({
  approvalGatedTools: ["opfs_write_file"],
  requestApproval: async ({ tool, detail }) => {
    if (detail?.file?.includes(".test.") || detail?.file?.includes(".spec.")) {
      return confirm(`Create test file: ${detail.file}?`);
    }
    return false;
  },
});

const opfsTools = createOpfsTools({ rootDir: "/project", approvalGate });

const testAgent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: opfsTools,
  systemPrompt: "Generate comprehensive unit tests with good coverage.",
  dangerouslyAllowBrowser: true,
});
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
