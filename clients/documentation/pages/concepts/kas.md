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
import { createKasAgent } from "@pstdio/kas";

const agent = createKasAgent({
  model: "gpt-5-mini",
  apiKey: "your-openai-key",
  workspaceDir: "/projects/my-app",
  requestApproval: async ({ tool, workspaceDir, detail }) => {
    return confirm(`Allow ${tool} in ${workspaceDir}?`);
  },
});

// Use with conversation
for await (const response of agent(messages)) {
  console.log(response);
}
```

## Try It Out

- **[Quick Start Guide](/getting-started/quick-start)** - Set up KAS in your app
- **[Live Playground](https://kaset.dev)** - Try KAS in action
- **[Package Documentation](/packages/kas)** - Complete API reference
