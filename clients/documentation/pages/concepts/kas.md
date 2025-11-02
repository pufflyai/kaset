---
title: Coding Agents
---

# Coding Agents in the Browser

KAS is a small coding agent that runs entirely client‑side. It uses OPFS for a safe, local file sandbox. KAS can search, read, patch, and generate files with user approval.

**KAS is available** as the [@pstdio/kas](/packages/kas) package.

## What KAS Can Do

KAS provides a complete coding agent that can:

- **Search and explore** files using grep, ls, and tree operations
- **Read and analyze** code, documents, and binary files
- **Patch and modify** existing files with precise edits
- **Create new files** and directory structures
- **Run shell commands** in a safe OPFS environment
- **Request approval** for destructive operations

## Key Features

- **Browser-first**: Runs entirely in the browser using OPFS
- **Safe sandbox**: All operations contained within OPFS workspace
- **Approval gates**: User consent required for file modifications
- **Streaming responses**: Real-time conversation updates
- **Conversation adapters**: Easy integration with UI frameworks

## Quick Example

```typescript
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

const workspaceDir = "/projects/my-app";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});

const opfsTools = createOpfsTools({ rootDir: workspaceDir, approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-openai-key",
  tools: opfsTools,
  dangerouslyAllowBrowser: true,
});

// Use with conversation
const messages = [{ role: "user", content: "Create a React component" }];
for await (const response of agent(messages)) {
  console.log(response);
}
```

## How KAS Works

### Architecture

KAS is built on a composable architecture:

1. **OPFS Integration**: Uses the browser's Origin Private File System for isolated file operations
2. **Tool System**: Provides file operations (read, write, patch, delete, search) as tools
3. **Approval Gates**: Intercepts destructive operations and requests user permission
4. **Streaming Interface**: Streams responses token-by-token for real-time feedback
5. **Conversation Adapters**: Transforms messages between UI and agent formats

### Tool Execution Flow

```
User Message → Agent → Tool Selection → Approval Check → Tool Execution → Response
                ↑                                                             |
                └─────────────── Continue if needed ──────────────────────────┘
```

### Approval System

KAS implements a flexible approval system that lets you control which operations require user consent:

- **Pre-configured gates**: Default protection for writes, deletes, patches, uploads, and moves
- **Custom approval logic**: Implement your own `requestApproval` callback
- **Context-aware**: Approval requests include tool name, workspace path, and operation details
- **Async-friendly**: Support for modal dialogs, API calls, or any async approval mechanism

## Real-World Scenarios

### Building a Component Library

KAS can help users create and organize React components:

```typescript
const messages = [
  {
    role: "user",
    content: "Create a Button component with primary, secondary, and danger variants",
  },
];
```

KAS will:

1. Create the component file with TypeScript
2. Add proper prop types and variants
3. Create a corresponding story file for Storybook
4. Update the index file to export the component

### Refactoring Code

Users can request broad refactoring tasks:

```typescript
const messages = [
  {
    role: "user",
    content: "Refactor all class components to functional components with hooks",
  },
];
```

KAS will:

1. Search for class components using `opfs_shell`
2. Read each component file
3. Convert to functional components
4. Apply patches with `opfs_patch`
5. Verify imports and dependencies

### Creating Documentation

Generate documentation from existing code:

```typescript
const messages = [
  {
    role: "user",
    content: "Generate README documentation for all components in src/components",
  },
];
```

KAS will:

1. List components using `opfs_ls`
2. Read each component's source
3. Extract props, usage patterns, and examples
4. Create comprehensive README files

## Security Considerations

### Browser Sandboxing

KAS operates within the browser's security model:

- **OPFS isolation**: Files are private to the origin
- **No filesystem access**: Cannot access the user's local filesystem
- **No network by default**: Only makes API calls to configured LLM endpoints
- **User approval**: Destructive operations require explicit consent

### Best Practices

1. **Never embed API keys**: Use a backend proxy to keep keys secure
2. **Validate tool inputs**: Check that paths stay within the workspace
3. **Limit tool access**: Only provide tools necessary for the use case
4. **Audit operations**: Log all tool invocations for review
5. **Use version control**: Integrate with isomorphic-git to track changes

### Workspace Boundaries

KAS enforces strict workspace boundaries:

```typescript
// Safe: Workspace-relative paths
await agent([{ role: "user", content: "Read src/index.ts" }]);

// Blocked: Parent traversal attempts are rejected
await agent([{ role: "user", content: "Read ../../../etc/passwd" }]);
```

## Integration Patterns

### With React

```typescript
import { useState, useMemo } from "react";
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";

function ChatInterface() {
  const [messages, setMessages] = useState([]);

  const agent = useMemo(() => {
    const approvalGate = createApprovalGate({
      requestApproval: async ({ tool }) => confirm(`Allow ${tool}?`),
    });

    const opfsTools = createOpfsTools({ rootDir: "/workspace", approvalGate });

    return createKasAgent({
      model: "gpt-5-mini",
      apiKey: "your-key",
      tools: opfsTools,
      dangerouslyAllowBrowser: true,
    });
  }, []);

  async function sendMessage(text: string) {
    const newMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, newMessage]);

    for await (const response of agent([...messages, newMessage])) {
      setMessages((prev) => [...prev.slice(0, -1), response]);
    }
  }

  return <div>{/* Render messages */}</div>;
}
```

### With Version Control

```typescript
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";
import { safeAutoCommit } from "@pstdio/opfs-utils";

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

// Run agent task
const messages = [{ role: "user", content: "Update the components" }];
for await (const response of agent(messages)) {
  console.log(response);
}

// Auto-commit changes
await safeAutoCommit({
  dir: workspaceDir,
  message: "KAS: Updated components",
  author: { name: "KAS", email: "kas@kaset.dev" },
});
```

### With Custom Tools

```typescript
import { createKasAgent, createApprovalGate } from "@pstdio/kas";
import { createOpfsTools } from "@pstdio/kas/opfs-tools";
import { Tool } from "@pstdio/tiny-ai-tasks";

const searchDocsT Tool = Tool(
  async ({ query }) => {
    const results = await searchDocs(query);
    return { messages: [{ role: "tool", content: JSON.stringify(results) }] };
  },
  {
    name: "search_docs",
    description: "Search project documentation",
  }
);

const workspaceDir = "/workspace";

const approvalGate = createApprovalGate({
  requestApproval: async ({ tool }) => confirm(`Allow ${tool}?`),
});

const opfsTools = createOpfsTools({ rootDir: workspaceDir, approvalGate });

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-key",
  tools: [...opfsTools, searchDocsTool],
  dangerouslyAllowBrowser: true,
});
```

## Limitations

### What KAS Cannot Do

- **Access local filesystem**: Cannot read/write files outside OPFS
- **Make arbitrary network requests**: Limited to configured API endpoints
- **Execute native binaries**: No access to system commands
- **Persist beyond origin**: OPFS data is origin-specific
- **Share between tabs**: Each tab has independent OPFS access

### When to Use Alternatives

Consider alternatives if you need:

- **Server-side processing**: Use traditional backend agents
- **Shared state across users**: Use cloud-based solutions
- **Native filesystem access**: Use desktop applications
- **Large file processing**: Browser memory limits may be restrictive

## Try It Out

- **[Quick Start Guide](/getting-started/quick-start)** - Set up KAS in your app
- **[Live Playground](https://kaset.dev)** - Try KAS in action
- **[Package Documentation](/packages/kas)** - Complete API reference
