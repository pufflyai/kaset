---
title: "Packages Overview"
---

# 📦 Packages

### [@pstdio/opfs-utils](/packages/opfs-utils)

**OPFS helpers for modern browsers** — Advanced file system operations including listing, grep search, safe file reading, and patch utilities.

Key features: `ls()`, `grep()`, `processSingleFileContent()`, `patch()`, `formatTree()`

---

### [@pstdio/opfs-sync](/packages/opfs-sync)

**Browser-cloud synchronization** — Two-way sync engine between OPFS and remote providers with conflict resolution.

Includes: Core `OpfsSync` class, `SupabaseRemote` adapter, change detection

---

### [@pstdio/prompt-utils](/packages/prompt-utils)

**LLM workflow utilities** — Optimized tools for prompt engineering and JSON stream processing.

Features: `prompt()`, `parseJSONStream()`, `getSchema()`, `safeStringify()`, UUID generation

---

### [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks)

**AI task building blocks** — Streaming LLM tasks with tool calls, tiny agent loop, history truncation/summarization, and scratchpad utilities.

Includes: `createLLMTask`, `createAgent`, `Tool`, `truncateToBudget`, `createSummarizer`

---

### [@pstdio/kas](/packages/kas)

**Browser coding agent** — Complete AI-powered coding assistant that runs entirely in the browser with OPFS sandbox.

Features: File operations with approval gates, shell commands, conversation adapters, streaming responses

---

### [@pstdio/tiny-tasks](/packages/tiny-tasks)

**Composable workflows** — Interrupt-friendly async generators you can pause, persist, and resume.

Includes: `task`, `createRuntime`, `MemorySaver`

---

### [describe-context](/packages/describe-context)

**Code context generation** — Transform folder structures into LLM-friendly Markdown documentation.

Tools: Library API `generateContext()`, CLI tool, selective file content inclusion

---
