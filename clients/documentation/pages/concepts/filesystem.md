---
title: Your App as a Filesystem
---

# Your App as a Filesystem

Kaset helps you add a workspace (using OPFS) inside your webapp that agents can browse and modify.

## What is OPFS?

The Origin Private File System (OPFS) is a browser-native file system that provides:

- **Private, persistent storage** that's invisible to users but accessible to your web app
- **High-performance file operations** with direct file handles and streaming capabilities
- **Sandbox security** with no cross-origin access concerns
- **Large storage capacity** typically much larger than localStorage or IndexedDB quotas

OPFS is perfect for applications that need to handle large files, perform complex file operations, or provide file-system-like experiences in the browser.

## Why model your app as a filesystem?

A file-based model makes your app legible to both users and agents. Instead of building dozens of specialized tools, you expose state, config, UI, and artifacts as files and folders:

- **Universal interface:** Agents already know how to read, search, and edit files.
- **Open-ended tasks:** Loosely defined work (themes, UI tweaks, content) is easy to express as file edits.
- **Diffs and review:** Text diffs are easy to review, approve, and version.
- **Offline‑first:** OPFS works without a server; sync to cloud when you want.

See also: [Application State](/modifications/app-state) and [Artifacts](/modifications/artifacts).

## OPFS basics in practice

- **Scope:** OPFS is private to your origin. No user picker is needed to read/write; it’s your app’s sandboxed storage.
- **Paths:** Utilities in Kaset use POSIX‑style relative paths like `"project/src/index.ts"`.
- **Persistence:** Ask the browser for persistent storage to reduce eviction risk.
- **Support:** See [Supported Browsers](/getting-started/supported-browsers).

## A simple workspace layout

You choose the structure; here’s a common pattern Kaset demos use:

```
.
├── agents.md             # Guidance for agents
└── <artifacts>/          # User outputs (docs, images, exports)
```

Keeping things predictable helps both your UI and agents reason about where to read and write.

## Everyday operations with @pstdio/opfs-utils

For hands‑on examples and API details, see [@pstdio/opfs-utils](/packages/opfs-utils). Below are the essentials.

### List and visualize files

```ts
import { ls, formatTree } from "@pstdio/opfs-utils";

// List under OPFS root ('' = root). Use a subdir if you prefer.
const entries = await ls("", { maxDepth: Infinity, stat: true, showHidden: false });
console.log(formatTree(entries));
```

### Read, write, move, delete

```ts
import { readFile, writeFile, moveFile, deleteFile } from "@pstdio/opfs-utils";

await writeFile("state/user.json", JSON.stringify({ theme: "dark" }, null, 2));
const text = await readFile("state/user.json");

await moveFile("state/user.json", "state/profile.json");
await deleteFile("state/profile.json");
```

### Search like grep

```ts
import { grep } from "@pstdio/opfs-utils";

const matches = await grep("", {
  pattern: "todo",
  flags: "i",
  include: ["**/*.md", "**/*.ts"],
  exclude: ["**/node_modules/**"],
});

for (const m of matches) {
  console.log(`${m.file}:${m.line}  ${m.lineText}`);
}
```

### Safely read files of any type

`processSingleFileContent` auto‑detects type, enforces size limits, and returns display‑friendly output.

```ts
import { processSingleFileContent } from "@pstdio/opfs-utils";

const result = await processSingleFileContent(
  "src/index.ts", // file path
  "", // root used for display context
  undefined, // legacy param
  0, // offset (line)
  1000, // limit (lines)
);

console.log(result.returnDisplay);
```

### Apply unified diffs (patch)

```ts
import { patch } from "@pstdio/opfs-utils";

const diff = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-export const meaning = 42;
+export const meaning = 41;`;

const outcome = await patch({
  workDir: "", // optional subdir base
  diffContent: diff,
});

console.log(outcome.output);
```

### Upload and download

```ts
import { pickAndUploadFilesToDirectory, downloadFile } from "@pstdio/opfs-utils";

// Let the user pick files from disk and import into OPFS
await pickAndUploadFilesToDirectory("artifacts", { destSubdir: "incoming", overwrite: "rename" });

// Trigger a download of a text file from OPFS
await downloadFile("artifacts/report.csv");
```

### Watch for changes

```ts
import { watchDirectory } from "@pstdio/opfs-utils";

const stop = await watchDirectory(
  "artifacts",
  (changes) => {
    for (const c of changes) console.log(`[${c.type}]`, c.path.join("/"));
  },
  { emitInitial: true },
);

// Later: stop();
```

## Syncing with a backend

When you need cross‑device or team collaboration, mirror an OPFS folder to a remote store.

- Use [@pstdio/opfs-sync](/packages/opfs-sync) for two‑way sync.
- A Supabase Storage remote is included; bring your own remote by implementing the same interface.

OPFS remains the fast local source of truth; sync makes it collaborative.

## React integration

Render OPFS content and keep UIs live‑updated with @pstdio/opfs-hooks. Under the hood it uses the same file and watcher utilities, but packaged as idiomatic hooks.

## Safety and best practices

- **Prefer text for diff‑ability:** Store user‑editable artifacts as text (Markdown, JSON) for easier review and patching.
- **Handle large files intentionally:** `processSingleFileContent` truncates safely; stream or chunk for very large assets.
- **Request persistence:** Improve resilience against storage eviction via `navigator.storage.persist()`.
- **Link capabilities intentionally:** Not everything should be a file. Use tools/APIs for actions that don’t map cleanly to file edits.

## Where to go next

- Package docs: [@pstdio/opfs-utils](/packages/opfs-utils) · [@pstdio/opfs-sync](/packages/opfs-sync)
- Concepts: [Application State](/modifications/app-state) · [Artifacts](/modifications/artifacts)
- Getting started: [Quick Start](/getting-started/quick-start) · [What is Kaset?](/getting-started/what-is-kaset)
