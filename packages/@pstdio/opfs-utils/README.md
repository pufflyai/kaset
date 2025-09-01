# @pstdio/opfs-utils

[![npm version](https://img.shields.io/npm/v/@pstdio/opfs-utils.svg?color=blue)](https://www.npmjs.com/package/@pstdio/opfs-utils)
[![license](https://img.shields.io/npm/l/@pstdio/opfs-utils)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fopfs-utils)](https://bundlephobia.com/package/%40pstdio%2Fopfs-utils)

Small, dependency-light utilities for working with the Origin Private File System (OPFS) in the browser.

> [Documentation](https://pufflyai.github.io/core-utils/packages/opfs-utils)

## Installation

```bash
npm i @pstdio/opfs-utils
# or
yarn add @pstdio/opfs-utils
# or
pnpm add @pstdio/opfs-utils
```

## Quick start

```ts
import { ls, grep, processSingleFileContent, patch, getSpecificMimeType } from "@pstdio/opfs-utils";

// OPFS root directory handle (requires secure context, e.g., https://)
const root = await navigator.storage.getDirectory();

// 1) List files and directories (depth 2)
const entries = await ls(root, {
  maxDepth: 2,
  showHidden: false,
});

console.log(entries.map((e) => `${e.kind} ${e.path}`));

// 2) Grep for a string (case-insensitive)
const matches = await grep(root, {
  pattern: "todo",
  flags: "i",
  include: ["**/*.ts", "**/*.md"],
});

for (const m of matches) {
  console.log(`${m.file}:${m.line}:${m.column}: ${m.match}`);
}

// 3) Safely read a file (with line window)
const read = await processSingleFileContent("src/index.ts", "", root, /* offset */ 0, /* limit  */ 200);

console.log(read.returnDisplay);
console.log(typeof read.llmContent === "string" ? read.llmContent : "<binary/media>");

// 4) Apply a unified diff
const diff = `*** dummy example, replace with a real unified diff ***`;
const result = await patch({
  root,
  diffContent: diff,
});

console.log(result.success, result.output);

// 5) MIME lookup
console.log(getSpecificMimeType("file.svg")); // "image/svg+xml"
```

## License

MIT © Pufflig AB
