---
title: "@pstdio/opfs-utils"
---

# @pstdio/opfs-utils

Small, dependency-light utilities for working with the Origin Private File System (OPFS) in the browser.

- ls: list files and folders with depth, filters, and sorting
- grep: fast text search with include/exclude globs and streaming matches
- processSingleFileContent: safe file reader with size/line limits and media handling
- patch: apply unified diffs to OPFS (optionally stage via isomorphic-git)
- getSpecificMimeType and helpers

## Install

```bash
npm i @pstdio/opfs-utils
```

## Quick start

```ts
import { ls, grep, processSingleFileContent, patch, getSpecificMimeType } from "@pstdio/opfs-utils";

const root = await navigator.storage.getDirectory();

const entries = await ls(root, { maxDepth: 2, showHidden: false });

const matches = await grep(root, { pattern: "todo", flags: "i", include: ["**/*.ts", "**/*.md"] });

const read = await processSingleFileContent("src/index.ts", "", root, 0, 200);

const diff = `--- a/hello.txt\n+++ b/hello.txt\n@@\n-Hello\n+Hello world\n`;
const result = await patch({ root, diffContent: diff });
```

## Notes

- Requires a secure context (https or localhost)
- Browser must implement OPFS

API details: see README in the package.

## Tree formatting

```ts
import { formatTree } from "@pstdio/opfs-utils";

// Pretty-print a tree from entries
console.log(formatTree(entries));

// Empty input renders a placeholder
console.log(formatTree([])); // "<empty>"
```
