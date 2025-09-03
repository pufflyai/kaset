---
title: Datazine Tools
---

# Datazine Tools

**A collection of tools to build browser-first, agentic web applications**

## 🤔 Why do these packages exist?

Coding agents have now become good enough that they can be applied to a wider range of tasks, provided the correct environment and project structure.

These packages help bring them to the browser, running next to your webapp, to edit, mod, extend your application files as desired by your users.

![architecture](/images/architecture.png)

## 📦 Packages Overview

<div style="margin: 1.5rem 0;">

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

### [describe-context](/packages/describe-context)

**Code context generation** — Transform folder structures into LLM-friendly Markdown documentation.

Tools: Library API `generateContext()`, CLI tool, selective file content inclusion

</div>
