# @pstdio/opfs-utils

Small, dependency-light utilities for working with the Origin Private File System (OPFS) in the browser. Includes:

- ls: list files and folders with depth, filters, and sorting
- grep: fast text search with include/exclude globs and streaming matches
- processSingleFileContent: safe file reader with size/line limits and media handling
- patch: apply unified diffs to OPFS (optionally stage via isomorphic-git)
- getSpecificMimeType and a couple of helpful constants

Works in modern browsers that implement the File System Access API (OPFS).

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
const entries = await ls(root, { maxDepth: 2, showHidden: false });
console.log(entries.map((e) => `${e.kind} ${e.path}`));

// 2) Grep for a string (case-insensitive)
const matches = await grep(root, { pattern: "todo", flags: "i", include: ["**/*.ts", "**/*.md"] });
for (const m of matches) console.log(`${m.file}:${m.line}:${m.column}: ${m.match}`);

// 3) Safely read a file (with line window)
const read = await processSingleFileContent("src/index.ts", "", root, /*offset*/ 0, /*limit*/ 200);
console.log(read.returnDisplay);
console.log(typeof read.llmContent === "string" ? read.llmContent : "<binary/media>");

// 4) Apply a unified diff
const diff = `*** dummy example, replace with a real unified diff ***`;
const result = await patch({ root, diffContent: diff });
console.log(result.success, result.output);

// 5) MIME lookup
console.log(getSpecificMimeType("file.svg")); // "image/svg+xml"
```

## Browser support and permissions

These utilities rely on the File System Access API and OPFS:

- Must run in a secure context (https or localhost)
- Available in Chromium-based browsers and Safari 17+ (varying levels)
- Access is scoped to your origin; no Node.js fs support

See: https://developer.mozilla.org/docs/Web/API/File_System_Access_API

## API

### ls(dirHandle, options)

Lists files and directories beneath a given `FileSystemDirectoryHandle`.

Inputs:

- dirHandle: FileSystemDirectoryHandle
- options: { maxDepth?, include?, exclude?, showHidden?, kinds?, stat?, concurrency?, signal?, onEntry?, sortBy?, sortOrder?, dirsFirst? }

Returns: Promise<LsEntry[]> where each entry has { path, name, kind, depth, size?, lastModified?, type? }.

Example:

```ts
const list = await ls(root, { maxDepth: Infinity, include: ["**/*"], stat: true });
```

Notes:

- include/exclude are simple globs supporting \*_, _, ?
- When `stat: true`, file size/mtime are fetched with limited concurrency
- Results can be streamed via `onEntry` as they’re discovered

### grep(dirHandle, options)

Recursive text search with optional glob filters and streaming matches.

Inputs:

- pattern: string | RegExp (if string, flags apply; if RegExp, it will be forced global)
- flags?: string (e.g., "i", "im")
- include?: string[]; exclude?: string[]
- maxFileSize?: number (default 20MB)
- concurrency?: number (default 4)
- encoding?: string (default "utf-8")
- signal?: AbortSignal
- onMatch?: (match) => void | Promise<void>

Returns: Promise<GrepMatch[]> with { file, line, column, match, lineText }.

Example with streaming:

```ts
await grep(root, {
  pattern: /\bTODO\b/i,
  include: ["**/*.ts", "**/*.tsx", "**/*.md"],
  onMatch(m) {
    console.log(`${m.file}:${m.line}:${m.column}: ${m.match}`);
  },
});
```

### processSingleFileContent(filePath, rootDirectory, dirHandle, offset?, limit?)

Reads a single file from OPFS with sensible limits and type-aware behavior.

Behavior:

- Text: returns up to `limit` lines from `offset`, truncating long lines
- SVG: read as text, up to 1MB
- Image/PDF/Audio/Video: returns an object with base64 `inlineData` and mimeType
- Binary/unknown: returns a human message and skips content
- Files > 20MB are rejected

Returns: Promise<ProcessedFileReadResult>

Key fields:

- llmContent: string for text, or { inlineData: { data, mimeType } } for media
- returnDisplay: short status string
- isTruncated, originalLineCount, linesShown
- error / errorType when applicable

Example:

```ts
const res = await processSingleFileContent("docs/readme.md", "docs", root, 0, 300);
if (typeof res.llmContent === "string") {
  console.log(res.llmContent);
}
```

Constants exported:

- DEFAULT_MAX_LINES_TEXT_FILE (2000)
- MAX_LINE_LENGTH_TEXT_FILE (2000)

### patch({ root, workDir?, diffContent, signal?, git? })

Apply a unified diff (git-style) to OPFS files. Creates, modifies, deletes, and renames files. Returns a summary plus details.

Optional isomorphic-git staging:

```ts
import * as isogit from "isomorphic-git";

const result = await patch({
  root,
  workDir: "project", // apply under OPFS/project
  diffContent: diffString, // unified diff
  git: {
    git: isogit,
    fs: yourIsoGitFs, // must mirror the same tree
    dir: "/repo", // repo root for isomorphic-git
    stage: true, // default true
  },
});
```

Returns: `{ success, output, details }` where `details` lists created/modified/deleted/renamed and failures.

Notes:

- Paths like a/foo and b/foo are normalized; /dev/null is treated as create/delete
- The `fs/dir` you pass to isomorphic-git must address the same files you changed in OPFS (use an adapter/mirroring strategy)

### getSpecificMimeType(filePathOrName)

Thin wrapper over `mime-types` lookup. Returns a string mime type or `undefined`.

## TypeScript

Everything is typed. Useful types you may import:

- `ProcessedFileReadResult`

```ts
import type { ProcessedFileReadResult } from "@pstdio/opfs-utils";
```

## Testing

This package uses Vitest. In this repo, from the package folder:

```bash
npm test
```

## Caveats and tips

- OPFS APIs are asynchronous and permissioned; expect user prompts in some flows
- For large trees, prefer `include`/`exclude` filters and reasonable concurrency
- Text detection is heuristic; some edge formats may be treated as binary or text

## License

MIT © Pufflig AB
