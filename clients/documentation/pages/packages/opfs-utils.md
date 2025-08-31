---
title: "@pstdio/opfs-utils"
---

# @pstdio/opfs-utils

Small, dependency-light utilities for working with the Origin Private File System (OPFS) in the browser.

- ls: list files and folders with depth, filters, sorting, and optional stats
- grep: fast text search with include/exclude globs and streaming matches
- processSingleFileContent: safe file reader with size/line limits and media handling
- patch: apply unified diffs to OPFS (optionally stage via isomorphic-git)
- formatTree: pretty-print a directory tree
- getSpecificMimeType and helpful constants

## Install

```bash
npm i @pstdio/opfs-utils
```

## Quick start

```ts
import { ls, grep, processSingleFileContent, patch, getSpecificMimeType, formatTree } from "@pstdio/opfs-utils";

const root = await navigator.storage.getDirectory();

const entries = await ls(root, { maxDepth: 2, showHidden: false });

const matches = await grep(root, { pattern: "todo", flags: "i", include: ["**/*.ts", "**/*.md"] });

const read = await processSingleFileContent("src/index.ts", "", root, 0, 200);

const diff = `--- a/hello.txt\n+++ b/hello.txt\n@@\n-Hello\n+Hello world\n`;
const result = await patch({ root, diffContent: diff });

console.log(formatTree(entries));
```

## Requirements

- Requires a secure context (https or localhost)
- Browser must implement OPFS

Works in Chromium-based browsers and Safari 17+ (varying levels). No Node.js `fs` support.

## API (concise)

### ls(dirHandle, options?) → Promise<LsEntry[]>

List files and directories under an OPFS directory handle.

Key options:

- maxDepth (number, default 1) — Infinity for full recursion
- include/exclude (string[]) — simple globs; supports `**`, `*`, `?` (no brace expansion)
- showHidden (boolean) — include dotfiles
- kinds ("file"|"directory"[]) — filter entry kinds
- stat (boolean) — fetch size/mtime/type for files
- concurrency (number) — stat parallelism (default 4)
- onEntry (fn) — streaming callback
- sortBy ("name"|"path"|"size"|"mtime"), sortOrder ("asc"|"desc"), dirsFirst (boolean)

Each LsEntry has { path, name, kind, depth, size?, lastModified?, type? }.

### grep(dirHandle, options) → `Promise<GrepMatch[]>`

Recursive text search with optional streaming via `onMatch`.

- pattern (string|RegExp) and flags (string) — RegExp forced global
- include/exclude (string[]) — globs with brace expansion
- maxFileSize (bytes, default 20MB), concurrency (default 4)
- encoding (default "utf-8"), signal, onMatch(match)

Returns matches with { file, line, column, match, lineText }.

### processSingleFileContent(filePath, rootDirectory, dirHandle, offset?, limit?)

Safely reads one file with type-aware behavior (text, svg, media, binary) and sensible limits.

- Returns ProcessedFileReadResult with `llmContent` (string or inlineData), `returnDisplay`, `isTruncated`, etc.
- Constants: DEFAULT_MAX_LINES_TEXT_FILE, MAX_LINE_LENGTH_TEXT_FILE

### patch({ root, workDir?, diffContent, signal?, git? })

Apply a unified diff to OPFS. Creates/modifies/deletes/renames.

- Optional isomorphic-git staging: pass { git, fs, dir, stage? }
- Returns { success, output, details: { created, modified, deleted, renamed, failed } }

### formatTree(entries) → string

Pretty-print a tree from `ls` results. For empty arrays returns `<empty>`.

### getSpecificMimeType(path) → string | undefined

Lightweight extension-to-MIME lookup.

## Tips

- Prefer include/exclude filters and moderate concurrency on large trees.
- OPFS prompts can appear; handle permission flows in your app.
- For diffs, ensure paths are git-style (a/foo, b/foo) or regular relative paths; /dev/null is supported for create/delete.
