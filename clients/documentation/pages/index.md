---
title: Datazine Core Utils
---

<div style="text-align: center; margin: 2rem 0;">

# 🛠️ Datazine Core Utils

**Modern, browser-first utilities for next-generation web applications**

Build powerful web apps with OPFS, cloud sync, LLM workflows, and developer tooling.

<div style="display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; margin: 1.5rem 0;">

![npm](https://img.shields.io/npm/v/@pstdio/opfs-utils?label=npm)
![node](https://img.shields.io/badge/node-22.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Browser](https://img.shields.io/badge/browser-modern-orange)

</div>

[📖 **Get Started**](#quick-start) • [📦 **Browse Packages**](#packages-overview) • [⚡ **Examples**](#examples) • [🔗 **GitHub**](https://github.com/pufflyai/core-utils)

</div>

---

## 🤔 Why Core Utils?

### The Problem

Modern web applications increasingly need to:
- **Store and process files locally** without server dependencies
- **Sync data between browser and cloud** for offline-first experiences  
- **Integrate with AI/LLM services** for intelligent features
- **Analyze codebases** for documentation and AI-assisted development

Traditional solutions are fragmented, server-dependent, or lack browser-first design.

### What Core Utils Solves

**Core Utils** provides a comprehensive, browser-first toolkit for building next-generation web applications that work offline, sync seamlessly with the cloud, and integrate naturally with AI workflows.

**Perfect for:**
- 📝 **Note-taking and document apps** that work offline and sync across devices
- 🛠️ **Developer tools and IDEs** that analyze code and provide AI assistance
- 📊 **Data analysis applications** that process files locally without server uploads
- 🤖 **AI-powered applications** that need local file processing and LLM integration
- 🔄 **Offline-first web apps** with selective cloud synchronization

---

## ✨ What's Inside

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 2rem 0;">

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 1.5rem;">
<h3>🗂️ OPFS Utilities</h3>
<p>Advanced file system operations in the browser with listing, searching, safe reads, and patching capabilities.</p>
</div>

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 1.5rem;">
<h3>☁️ Cloud Sync</h3>
<p>Two-way synchronization between OPFS and remote storage providers like Supabase with conflict resolution.</p>
</div>

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 1.5rem;">
<h3>🤖 LLM Workflows</h3>
<p>Prompt utilities and JSON stream parsing optimized for Large Language Model integrations.</p>
</div>

<div style="border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 1.5rem;">
<h3>📋 Context Generation</h3>
<p>Analyze folders and generate LLM-ready Markdown context for code review and documentation.</p>
</div>

</div>

## 🚀 Quick Start

### Installation

Install individual packages as needed:

```bash
# OPFS utilities
npm install @pstdio/opfs-utils

# Cloud synchronization
npm install @pstdio/opfs-sync

# LLM prompt helpers
npm install @pstdio/prompt-utils

# Context generation
npm install @pstdio/describe
```

### Basic Usage

```typescript
// List files in OPFS
import { ls } from '@pstdio/opfs-utils';

const files = await ls('/my-folder', { 
  recursive: true,
  includeStats: true 
});

// Sync with remote storage
import { OpfsSync, SupabaseRemote } from '@pstdio/opfs-sync';

const sync = new OpfsSync('/local-folder', new SupabaseRemote(config));
await sync.syncToRemote();

// Generate context for LLMs
import { generateContext } from '@pstdio/describe-context';

const context = await generateContext('./src');
```

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

### [@pstdio/describe-context](/packages/describe)

**Code context generation** — Transform folder structures into LLM-friendly Markdown documentation.

Tools: Library API `generateContext()`, CLI tool, selective file content inclusion

</div>

## 🎯 Examples

### File System Operations

```typescript
import { ls, grep } from '@pstdio/opfs-utils';

// Advanced file listing
const results = await ls('/docs', {
  recursive: true,
  filter: (entry) => entry.name.endsWith('.md'),
  sort: 'modified'
});

// Search across files
const matches = await grep('/src', '\\bfunction\\b', {
  includeLineNumbers: true,
  filePattern: '*.{ts,js}'
});
```

### Cloud Synchronization

```typescript
import { OpfsSync, SupabaseRemote } from '@pstdio/opfs-sync';

const remote = new SupabaseRemote({
  url: 'https://your-project.supabase.co',
  key: 'your-anon-key',
  bucket: 'documents'
});

const sync = new OpfsSync('/local-docs', remote);

// Two-way sync with conflict resolution
await sync.syncBidirectional();
```

## 🎨 Why Choose Core Utils?

- **🌐 Browser-First**: Designed specifically for modern web applications
- **⚡ Performance**: Optimized for large files and high-throughput operations  
- **🔒 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **📦 Modular**: Use only what you need with tree-shakable packages
- **🛡️ Reliable**: Comprehensive error handling and safety checks
- **📚 Well-Documented**: Extensive documentation and examples

## 🔗 Resources

- [📖 **Full Documentation**](https://pufflyai.github.io/core-utils/)
- [🐙 **GitHub Repository**](https://github.com/pufflyai/core-utils)
- [📋 **Issues & Feedback**](https://github.com/pufflyai/core-utils/issues)
- [📜 **License**](https://github.com/pufflyai/core-utils/blob/main/LICENSE) (MIT)

---

<div style="text-align: center; margin: 2rem 0; padding: 1.5rem; background-color: var(--vp-c-bg-soft); border-radius: 8px;">

**Ready to build something amazing?** 

[Get Started with OPFS Utils →](/packages/opfs-utils) | [Explore All Packages →](#packages-overview)

</div>
