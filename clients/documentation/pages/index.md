---
title: Kaset
---

![Kaset banner](/images/kaset.png)

# Introduction

**Kaset** [kaˈset] is a collection of open source tools to build browser-first, agentic web apps.

::: tip
Kaset is in early development, [join our discussions](https://github.com/pufflyai/kaset/discussions) and help shape it.
:::

## 🤔 What are agentic web apps?

Programming has always been a _prelude_: developers write code, ship it, and users consume it.

Now imagine your average user being able to create plugins for your web app on the fly.

No coding experience required.

Directly _inside_ your app.

Modern coding agents have reached a point where they can meaningfully contribute to a wide variety of tasks, if they are placed in the right environment, with the right project structure.

Kaset brings these agents into the browser and into your application, giving your users the power to edit, mod, and extend it as they see fit.

![architecture](/images/architecture.png)

**The key idea**: if your application’s state, configuration, and functionality are broken down into files, then generic coding agents can operate on them naturally.

---

> With Kaset, the focus shifts from building custom agentic systems for your app, to designing environments where agents can operate effectively.

---

**Some Examples**

- Treat your application like a moddable game, where agents help users create and share new features.
- Let users extend dashboards, tweak workflows, or build integrations without writing code.
- Ship minimal features and let agents (guided by users) fill in the long tail of custom needs.

Do you have a specific use case in mind? Let us know [here](https://github.com/pufflyai/kaset/discussions/categories/ideas).

## 🎯 Design Goals

Kaset is built with a few clear goals in mind:

### 1. **Browser-first**

Kaset runs where your users already are — the browser.
No heavyweight server setup required, no special IDE.
Agents and users collaborate directly inside the app.

### 2. **File-based state**

Application state, configuration, and functionality are represented as files.
This makes apps legible to both humans and coding agents, while enabling versioning, diffs, and safe rollbacks.

### 3. **Agent-native**

Kaset is designed for coding agents as first-class participants, not bolted-on assistants.
Agents work in structured environments with clear boundaries, permissions, and safe sandboxes.

### 4. **Reversible by design**

Every agent action should be transparent, auditable, and undoable.
Users remain in control, with the ability to review or revert changes at any time.

## 📦 Packages Overview (WIP)

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

### [@pstdio/tiny-ai-tasks](/packages/tiny-ai-tasks)

**AI task building blocks** — Streaming LLM tasks with tool calls, tiny agent loop, history truncation/summarization, and scratchpad utilities.

Includes: `createLLMTask`, `createAgent`, `Tool`, `truncateToBudget`, `createSummarizer`

---

### [@pstdio/tiny-tasks](/packages/tiny-tasks)

**Composable workflows** — Interrupt-friendly async generators you can pause, persist, and resume.

Includes: `task`, `createRuntime`, `MemorySaver`

---

### [describe-context](/packages/describe-context)

**Code context generation** — Transform folder structures into LLM-friendly Markdown documentation.

Tools: Library API `generateContext()`, CLI tool, selective file content inclusion

</div>

---

Need more detail? Check the [FAQ](/faq), including “Can’t I just do the same using MCP?”.
