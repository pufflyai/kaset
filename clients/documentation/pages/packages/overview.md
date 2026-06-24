---
title: "Packages Overview"
---

# 📦 Packages

### [@pstdio/kas](/packages/kas)

**Browser coding agent** — Complete AI-powered coding assistant that runs entirely in the browser with OPFS sandbox.

Features: File operations with approval gates, shell commands, conversation adapters, streaming responses

### [@pstdio/opfs-hooks](/packages/opfs-hooks)

**React hooks for OPFS** — React hooks for working with the browser's Origin Private File System with reactive updates.

Includes: `useFolder`, `useFileContent`, `useOpfsStoreBinding`

### [@pstdio/opfs-utils](/packages/opfs-utils)

**OPFS helpers for modern browsers** — Advanced file system operations including listing, grep search, safe file reading, and patch utilities.

Key features: `ls()`, `grep()`, `processSingleFileContent()`, `patch()`, `formatTree()`

### [@pstdio/opfs-sync](/packages/opfs-sync)

**Browser-cloud synchronization** — Two-way sync engine between OPFS and remote providers with conflict resolution.

Includes: Core `OpfsSync` class, `SupabaseRemote` adapter, change detection

### [@pstdio/prompt-utils](/packages/prompt-utils)

**LLM workflow utilities** — Optimized tools for prompt engineering and JSON stream processing.

Features: `prompt()`, `parseJSONStream()`, `getSchema()`, `safeStringify()`, UUID generation

### [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks)

**AI task building blocks** — Streaming LLM tasks with tool calls, tiny agent loop, history truncation/summarization, and scratchpad utilities.

Includes: `openaiModel`, `createAgent`, `Tool`, `truncateToBudget`, `createSummarizer`

### [@pstdio/tiny-plugins](/packages/tiny-plugins)

**Tiny plugin runtime** — Watch OPFS-backed plugins, validate manifests, execute commands, and persist settings with the modern `createHost` API.

Includes: `createHost`, `HOST_API_VERSION`, `mergeManifestDependencies`, Tiny AI Tasks adapter

### [@pstdio/tiny-tasks](/packages/tiny-tasks)

**Composable workflows** — Interrupt-friendly async generators you can pause, persist, and resume.

Includes: `task`, `createRuntime`, `MemorySaver`

### [@pstdio/tiny-ui](/packages/tiny-ui)

**Browser-first plugin runtime** — Compile OPFS-backed sources with esbuild-wasm, cache bundles in a service worker, and expose host capabilities to plugin iframes.

Includes: `TinyUI`, `compile`, `loadSnapshot`, `createTinyHost`

### [@pstdio/tiny-ui-bundler](/packages/tiny-ui-bundler)

**Runtime asset and bundling pipeline** — Manage Tiny UI's service worker, cache storage, and import maps while compiling plugin sources entirely in the browser.

Includes: `registerSources`, `compile`, `setLockfile`, `prepareRuntimeAssets`

### [describe-context](/packages/describe-context)

**Code context generation** — Transform folder structures into LLM-friendly Markdown documentation.

Tools: Library API `generateContext()`, CLI tool, selective file content inclusion

---
