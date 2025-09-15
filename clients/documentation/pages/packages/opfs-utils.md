---
title: "@pstdio/opfs-utils"
---

# @pstdio/opfs-utils

A comprehensive toolkit for working with the **Origin Private File System (OPFS)** in modern browsers. This library provides dependency-light utilities that make OPFS operations simple, safe, and performant.

## What is OPFS?

The Origin Private File System (OPFS) is a browser-native file system that provides:

- **Private, persistent storage** that's invisible to users but accessible to your web app
- **High-performance file operations** with direct file handles and streaming capabilities
- **Sandbox security** with no cross-origin access concerns
- **Large storage capacity** typically much larger than localStorage or IndexedDB quotas

OPFS is perfect for applications that need to handle large files, perform complex file operations, or provide file-system-like experiences in the browser.

## Core Features

- **`ls`** - List files and directories with advanced filtering, sorting, and streaming
- **`grep`** - Fast text search across file trees with glob patterns and streaming results
- **`processSingleFileContent`** - Smart file reading with type detection and safety limits
- **`patch`** - Apply unified diffs with optional git integration
- **`formatTree`** - Pretty-print directory structures
- **`getSpecificMimeType`** - Lightweight MIME type detection
- **OPFS shell** - Run mini shell commands with `runOpfsCommandLine`
- **Git helpers** - Repo setup, status, commits, checkout/restore operations

## Browser Compatibility

For the latest browser support information, see [MDN's Origin Private File System documentation](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

**Detection**: Use `'storage' in navigator && 'getDirectory' in navigator.storage` to check for OPFS availability.

## Installation

```bash
npm i @pstdio/opfs-utils
```

## Quick Start

### Basic File System Operations

```ts
import { ls, formatTree } from "@pstdio/opfs-utils";

// List files and directories under OPFS (use '' for OPFS root)
const entries = await ls("", {
  maxDepth: 2,
  showHidden: false,
  stat: true, // Include file sizes and modification times
});

// Pretty print the directory structure
console.log(formatTree(entries));
```

### Text Search Across Files

```ts
import { grep } from "@pstdio/opfs-utils";

// Search for "TODO" in TypeScript and Markdown files
const matches = await grep("", {
  pattern: "todo",
  flags: "i", // Case insensitive
  include: ["**/*.ts", "**/*.md"],
  onMatch: (match) => {
    console.log(`Found in ${match.file}:${match.line} - ${match.lineText}`);
  },
});
```

### Safe File Reading

```ts
import { processSingleFileContent } from "@pstdio/opfs-utils";

// Safely read a file with automatic type detection
const result = await processSingleFileContent(
  "src/index.ts", // File path
  "", // Root directory used for display (empty = OPFS root)
  undefined, // legacy param (unused)
  0, // Start offset
  1000, // Max lines to read
);

if (result.isTruncated) {
  console.log("File was truncated due to size limits");
}

console.log(result.llmContent); // Safe, processed content
```

### Applying Patches

```ts
import { patch } from "@pstdio/opfs-utils";

// Apply a unified diff
const diff = `--- a/hello.txt
+++ b/hello.txt
@@ -1 @@
-Hello
+Hello world`;

const result = await patch({
  diffContent: diff,
});

if (result.success) {
  console.log(`Modified ${result.details.modified.length} files`);
}
```

### CRUD helpers

```ts
import { readFile, writeFile, deleteFile, downloadFile, moveFile } from "@pstdio/opfs-utils";

await writeFile("data/inbox/hello.txt", "Hi!");
const text = await readFile("data/inbox/hello.txt"); // "Hi!"
await deleteFile("data/inbox/hello.txt");

// Rename or move a file (creates parent dirs as needed)
await moveFile("data/inbox/hello.txt", "data/archive/hello.txt");

// In a browser page (text files):
await downloadFile("data/report.csv"); // triggers a download
```

### Upload Files

```ts
import { pickAndUploadFilesToDirectory } from "@pstdio/opfs-utils";

const result = await pickAndUploadFilesToDirectory("data", {
  destSubdir: "incoming",
  overwrite: "rename",
});

console.log(result.uploadedFiles, result.errors);
```

### Watch a Directory

```ts
import { watchDirectory } from "@pstdio/opfs-utils";

const stop = await watchDirectory("data", (changes) => {
  for (const c of changes) {
    console.log(`[${c.type}]`, c.path.join("/"));
  }
});

// Later: stop();
```

#### Watch API

- `watchDirectory(dirPath, callback, options?)`
- `watchOPFS(callback, options?)` // shorthand for `watchDirectory('', ...)`

```ts
interface WatchOptions {
  intervalMs?: number; // Polling interval (default 1500ms)
  pauseWhenHidden?: boolean; // Pause when tab hidden (default true)
  emitInitial?: boolean; // Emit snapshot on start (default false)
  recursive?: boolean; // Recurse into subdirectories (default true)
  signal?: AbortSignal; // Cancellation support
  ignore?: RegExp | RegExp[] | ((pathParts: string[], handle: FileSystemHandle) => boolean);
}

interface ChangeRecord {
  type: "appeared" | "modified" | "disappeared" | "moved" | "unknown" | "errored";
  path: string[]; // path split into segments
  size?: number;
  lastModified?: number;
  handleKind?: FileSystemHandle["kind"];
}
```

## Interactive Playground

Want to experiment with `@pstdio/opfs-utils`? The package includes a comprehensive **Storybook playground** where you can:

- Create and manage files in OPFS
- Test all API functions interactively
- See real-time results and file structures
- Learn through hands-on examples

```bash
cd packages/@pstdio/opfs-utils
npm run storybook
```

Then navigate to the "Playground" story for an interactive OPFS environment.

## API Reference

### `ls(dirPath, options?)` → `Promise<LsEntry[]>`

List files and directories under a POSIX-like path within OPFS (use "" for the OPFS root) with powerful filtering and sorting capabilities.

```ts
interface LsOptions {
  maxDepth?: number; // Default: 1, use Infinity for full recursion
  include?: string[]; // Glob patterns to include (e.g., ["**/*.js", "*.md"])
  exclude?: string[]; // Glob patterns to exclude (e.g., ["**/node_modules/**"])
  showHidden?: boolean; // Include dotfiles (default: false)
  kinds?: ("file" | "directory")[]; // Filter by entry type
  stat?: boolean; // Fetch size/mtime for files (default: false)
  concurrency?: number; // Stat operation parallelism (default: 4)
  sortBy?: "name" | "path" | "size" | "mtime"; // Sort key (default: "name")
  sortOrder?: "asc" | "desc"; // Sort direction (default: "asc")
  dirsFirst?: boolean; // Directories before files (default: true)
  signal?: AbortSignal; // Cancellation support
  onEntry?: (entry: LsEntry) => void; // Streaming callback
}

interface LsEntry {
  path: string; // POSIX-style path relative to dirPath
  name: string; // File/directory name
  kind: "file" | "directory";
  depth: number; // Depth level (1 = direct children)
  size?: number; // File size in bytes (when stat: true)
  lastModified?: number; // Unix timestamp (when stat: true)
  type?: string; // MIME type (when stat: true)
}
```

**Examples:**

```ts
// List only JavaScript files, sorted by size
const jsFiles = await ls("", {
  include: ["**/*.js", "**/*.ts"],
  stat: true,
  sortBy: "size",
  sortOrder: "desc",
});

// Stream large directory listings
await ls("", {
  maxDepth: Infinity,
  onEntry: (entry) => {
    if (entry.kind === "file" && entry.size > 1000000) {
      console.log(`Large file: ${entry.path} (${entry.size} bytes)`);
    }
  },
});

// Find all hidden directories
const hiddenDirs = await ls("", {
  maxDepth: 3,
  showHidden: true,
  kinds: ["directory"],
  exclude: ["**/.git/**"],
});
```

### `grep(dirPath, options)` → `Promise<GrepMatch[]>`

Perform recursive text search with advanced filtering and streaming support.

```ts
interface GrepOptions {
  pattern: string | RegExp; // Search pattern (string becomes RegExp)
  flags?: string; // RegExp flags (e.g., "i" for case-insensitive)
  include?: string[]; // File patterns to include
  exclude?: string[]; // File patterns to exclude
  maxFileSize?: number; // Skip files larger than N bytes (default: 20MB)
  concurrency?: number; // Max parallel file processing (default: 4)
  encoding?: string; // Text encoding (default: "utf-8")
  signal?: AbortSignal; // Cancellation support
  onMatch?: (match: GrepMatch) => void; // Streaming callback
}

interface GrepMatch {
  file: string; // File path where match was found
  line: number; // 1-based line number
  column: number; // 1-based column number
  match: string; // The matched substring
  lineText: string; // Full line content (without \n)
}
```

**Examples:**

```ts
// Find all TODO comments in source code
const todos = await grep("", {
  pattern: /TODO|FIXME|XXX/i,
  include: ["**/*.ts", "**/*.js", "**/*.tsx"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});

// Search with streaming for large codebases
await grep("", {
  pattern: "function.*async",
  flags: "g",
  include: ["**/*.js"],
  onMatch: (match) => {
    console.log(`Async function at ${match.file}:${match.line}`);
  },
});

// Case-sensitive search in documentation
const apiRefs = await grep("", {
  pattern: "API",
  include: ["**/*.md", "**/*.txt"],
  maxFileSize: 1024 * 1024, // 1MB limit
});
```

### `processSingleFileContent(filePath, rootDirectory, _unused?, offset?, limit?, options?)`

Safely read and process a single file with intelligent type detection and safety limits.

```ts
interface ProcessedFileReadResult {
  llmContent: any; // string for text, { inlineData: { data, mimeType } } for images/PDF/audio/video
  returnDisplay: string; // Human-readable display summary
  error?: string; // Optional error message
  errorType?: string; // Optional error type identifier
  isTruncated?: boolean; // For text files, whether content range/length was truncated
  originalLineCount?: number; // For text files
  linesShown?: [number, number]; // For text files (1-based inclusive range)
}

// Constants available for customization
const DEFAULT_MAX_LINES_TEXT_FILE = 2000;
const MAX_LINE_LENGTH_TEXT_FILE = 2000;
```

**Examples:**

```ts
// Read a configuration file
const config = await processSingleFileContent(
  "config/app.json",
  "",
  undefined,
  0, // Start from beginning
  100, // Max 100 lines
);

// Parse if JSON by path
if (config.llmContent && "config/app.json".endsWith(".json")) {
  const data = JSON.parse(String(config.llmContent));
}

// Read a large log file with offset
const logs = await processSingleFileContent(
  "logs/app.log",
  "",
  undefined,
  1000, // Start from line 1000
  500, // Read 500 lines
);

// Handle different file types
const media = await processSingleFileContent("images/logo.png", "");
// For non-text files, returns inline data for embedding
console.log(media.llmContent.inlineData.mimeType); // e.g., "image/png"
console.log(media.llmContent.inlineData.data.slice(0, 24)); // base64 prefix
```

### `patch({ workDir?, diffContent, maxOffsetLines?, sanitizeAnsiDiff?, signal?, git? })`

Apply unified diff patches to OPFS files with optional git staging support.

```ts
interface PatchOptions {
  workDir?: string; // Subdirectory to work in (relative to OPFS root)
  diffContent: string; // Unified diff content
  maxOffsetLines?: number; // Fuzzy placement window for hunks (default 200)
  sanitizeAnsiDiff?: boolean; // Strip ANSI sequences from diff (default true)
  signal?: AbortSignal; // Cancellation support
  git?: {
    git: typeof import("isomorphic-git");
    fs: any; // isomorphic-git fs interface (same tree as OPFS adapter)
    dir: string; // Git repository directory
    stage?: boolean; // Stage changes after applying (default true)
  };
}

interface PatchResult {
  success: boolean; // Overall operation success
  output: string; // Operation summary
  details: {
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
    failed: Array<{ path: string; reason: string }>;
  };
}
```

**Examples:**

```ts
// Apply a simple patch
const diff = `--- a/package.json
+++ b/package.json  
@@ -1,4 +1,4 @@
 {
   "name": "my-app",
-  "version": "1.0.0",
+  "version": "1.1.0",
   "main": "index.js"`;

const result = await patch({ diffContent: diff });

if (result.success) {
  console.log(`Updated ${result.details.modified.length} files`);
} else {
  console.error("Patch failed:", result.output);
}

// Create a new file via patch
const createDiff = `--- /dev/null
+++ b/new-file.txt
@@ -0,0 +1,3 @@
+Line 1
+Line 2  
+Line 3`;

await patch({ diffContent: createDiff });

// Delete a file via patch
const deleteDiff = `--- a/old-file.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-Old content
-To be removed`;

await patch({ diffContent: deleteDiff });
```

### `formatTree(entries)` → `string`

Convert an array of `LsEntry` objects into a pretty-printed directory tree.

```ts
// Simple tree formatting
const entries = await ls("", { maxDepth: 2 });
console.log(formatTree(entries));
// Output:
// ├── src/
// │   ├── index.ts
// │   └── utils.ts
// └── package.json

// Empty directory handling
console.log(formatTree([])); // Returns "<empty>"
```

### `getSpecificMimeType(path)` → `string | undefined`

Lightweight file extension to MIME type mapping.

```ts
// File type detection
console.log(getSpecificMimeType("app.js")); // "application/javascript"
console.log(getSpecificMimeType("data.json")); // "application/json"
console.log(getSpecificMimeType("style.css")); // "text/css"
console.log(getSpecificMimeType("image.png")); // "image/png"
console.log(getSpecificMimeType("unknown.xyz")); // undefined

// Works with full paths
console.log(getSpecificMimeType("/path/to/file.ts")); // "text/plain"
```

## Shell Utilities

### `runOpfsCommandLine(cmdline, options?)` → `{ stdout, stderr, code }`

Execute simple Unix-like commands against OPFS paths with pipes and logical AND.

```ts
import { runOpfsCommandLine } from "@pstdio/opfs-utils";

// List TypeScript files and find TODOs
const { stdout, stderr, code } = await runOpfsCommandLine(`ls src && rg "TODO" --include "**/*.ts"`, { cwd: "" });

console.log(stdout);
```

Supported commands: `ls`, `nl`, `find`, `echo`, `sed`, `wc`, `rg` (ripgrep-like). Use `cwd` to set a working subdirectory. `onChunk` streams output as it’s produced.

## Git Helpers

High-level helpers for working with a git repository stored in OPFS via isomorphic-git.

- `ensureRepo({ dir, defaultBranch?, name?, email? })`
- `getRepoStatus({ dir })`
- `commitAll({ dir }, { message, author, branch?, dryRun? })`
- `listCommits({ dir }, { limit?, ref? })`, `listAllCommits({ dir }, { limit?, includeTags?, perRefDepth?, refs? })`
- `revertToCommit({ dir }, { to, mode?, force? })`, `previewCommit({ dir }, to)`
- `checkoutAtCommit({ dir }, { at, paths?, force? })`
- `resolveOid({ dir }, refOrSha)`, `getHeadState({ dir })`, `attachHeadToBranch({ dir }, branch, opts?)`
- `continueFromCommit({ dir }, { to, branch?, force?, refuseUpdateExisting? })`
- `safeAutoCommit({ dir, message, author })`

Example:

```ts
import { ensureRepo, getRepoStatus, commitAll, listCommits } from "@pstdio/opfs-utils";

const ctx = { dir: "project" };

await ensureRepo(ctx, { defaultBranch: "main", name: "You", email: "you@example.com" });

const status = await getRepoStatus(ctx);
console.log(status.added, status.modified, status.deleted);

const { oid, summary } = await commitAll(ctx, {
  message: "chore: initial commit",
  author: { name: "You", email: "you@example.com" },
});

console.log(oid, summary);

const commits = await listCommits(ctx, { limit: 5 });
console.log(commits.map((c) => `${c.oid.slice(0, 7)} ${c.message}`));
```

## Path & Utilities

Common helper functions exported for working with OPFS paths and content:

- `basename(p)`, `parentOf(p)`, `joinPath(a, b)`
- `normalizeSegments(p)`, `normalizeSlashes(p)`, `normalizeRelPath(p)`
- `isWithinRoot(path, rootDirectory)`, `hasParentTraversal(p)`, `joinUnderWorkspace(workspaceDir, rel)`
- `ensureDirExists(path, create)`, `getDirectoryHandle(path)`
- `stripAnsi(s)`

## Real-World Usage Patterns

### Building a Code Editor

```ts
import { ls, grep, processSingleFileContent, patch, formatTree } from "@pstdio/opfs-utils";

class OPFSCodeEditor {
  constructor(private workDir: string = "") {}

  // File explorer functionality
  async getProjectStructure() {
    const entries = await ls(this.workDir, {
      maxDepth: 5,
      exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      stat: true,
      sortBy: "name",
      dirsFirst: true,
    });
    return formatTree(entries);
  }

  // Search across project
  async searchInProject(query: string) {
    return grep(this.workDir, {
      pattern: query,
      flags: "i",
      include: ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx"],
      exclude: ["**/node_modules/**"],
    });
  }

  // Load file for editing
  async loadFile(filePath: string) {
    return processSingleFileContent(filePath, this.workDir);
  }

  // Apply code changes via diff
  async applyChanges(diffContent: string) {
    return patch({ workDir: this.workDir, diffContent });
  }
}
```

### Documentation Site Generator

```ts
import { ls, processSingleFileContent, formatTree } from "@pstdio/opfs-utils";

async function generateDocsSiteMap() {
  // Find all markdown files
  const entries = await ls("", {
    maxDepth: Infinity,
    include: ["**/*.md"],
    exclude: ["**/node_modules/**"],
    stat: true,
  });

  const siteMap = [];

  for (const entry of entries) {
    const content = await processSingleFileContent(entry.path, "", undefined, 0, 50);

    // Extract frontmatter title
    const titleMatch = content.llmContent.match(/^title:\s*"?([^"\n]+)"?/m);
    const title = titleMatch?.[1] || entry.name.replace(".md", "");

    siteMap.push({
      path: entry.path,
      title,
      size: entry.size,
      lastModified: entry.lastModified,
    });
  }

  return siteMap.sort((a, b) => a.path.localeCompare(b.path));
}
```

### Log Analysis Tool

```ts
import { grep, ls } from "@pstdio/opfs-utils";

async function analyzeLogs() {
  // Find error patterns in log files
  const errors = await grep("", {
    pattern: /ERROR|FATAL|CRITICAL/i,
    include: ["**/*.log", "**/logs/**/*.txt"],
    onMatch: (match) => {
      console.log(`🚨 ${match.file}:${match.line} - ${match.lineText}`);
    },
  });

  // Get log file statistics
  const logFiles = await ls("", {
    include: ["**/*.log"],
    stat: true,
    sortBy: "size",
    sortOrder: "desc",
  });

  return {
    totalErrors: errors.length,
    largestLogFile: logFiles[0],
    errorsByFile: errors.reduce(
      (acc, error) => {
        acc[error.file] = (acc[error.file] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
}
```

## Error Handling & Troubleshooting

### Common Issues

**OPFS Not Available**

```ts
async function checkOPFSSupport() {
  if (!("storage" in navigator)) {
    throw new Error("Storage API not supported");
  }

  if (!("getDirectory" in navigator.storage)) {
    throw new Error("OPFS not supported in this browser");
  }

  try {
    const root = await navigator.storage.getDirectory();
    return root;
  } catch (error) {
    if (error.name === "SecurityError") {
      throw new Error("OPFS access denied. Ensure you're on HTTPS or localhost.");
    }
    throw error;
  }
}
```

**Permission Denied Errors**

```ts
async function handlePermissionErrors() {
  try {
    await navigator.storage.getDirectory();
    const entries = await ls("");
    return entries;
  } catch (error) {
    if (error.name === "NotAllowedError") {
      // User denied permission or site is not in secure context
      console.error("OPFS permission denied. Check if:");
      console.error("1. Site is served over HTTPS or localhost");
      console.error("2. User granted storage permission");
      console.error("3. Browser supports OPFS");
    }
    throw error;
  }
}
```

**File Size Limits**

```ts
async function safeFileRead(filePath: string) {
  try {
    const result = await processSingleFileContent(filePath, "");

    if (result.isTruncated) {
      console.warn(`File ${filePath} was truncated due to size limits`);
      // Handle truncated content appropriately
    }

    return result;
  } catch (error) {
    if (error.message.includes("File too large")) {
      console.error(`File ${filePath} exceeds size limits`);
      // Use streaming or chunked reading for large files
    }
    throw error;
  }
}
```

**Cancellation Support**

```ts
async function cancellableOperation() {
  const controller = new AbortController();

  // Cancel operation after 10 seconds
  setTimeout(() => controller.abort(), 10000);

  try {
    const results = await grep("", {
      pattern: "search term",
      include: ["**/*"],
      signal: controller.signal, // Pass abort signal
    });
    return results;
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("Operation was cancelled");
    }
    throw error;
  }
}
```

## Performance Best Practices

### Optimize File System Operations

```ts
// ✅ Good: Use specific include patterns
const jsFiles = await ls("", {
  include: ["**/*.js", "**/*.ts"],
  maxDepth: 3, // Limit depth if possible
});

// ❌ Bad: Scan entire file system
const allFiles = await ls("", { maxDepth: Infinity });
```

### Efficient Text Search

```ts
// ✅ Good: Use streaming for large searches
const matches = [];
await grep("", {
  pattern: "TODO",
  include: ["src/**/*.ts"],
  onMatch: (match) => {
    matches.push(match);
    if (matches.length >= 100) {
      // Process batch and clear array to manage memory
      processBatch(matches.splice(0, 100));
    }
  },
});

// ✅ Good: Limit file size for text search
await grep("", {
  pattern: "config",
  maxFileSize: 1024 * 1024, // 1MB limit
  concurrency: 2, // Reduce concurrency for large files
});
```

### Memory Management

```ts
// ✅ Good: Process files in batches
async function processLargeDirectory() {
  const BATCH_SIZE = 100;
  let processed = 0;

  await ls("", {
    maxDepth: Infinity,
    onEntry: async (entry) => {
      if (entry.kind === "file") {
        await processFile(entry);
        processed++;

        if (processed % BATCH_SIZE === 0) {
          // Give other tasks a chance to run
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    },
  });
}
```

### Concurrent Operations

```ts
// ✅ Good: Limit concurrency for intensive operations
await grep("", {
  pattern: "search term",
  concurrency: 4, // Reasonable concurrency
  maxFileSize: 10 * 1024 * 1024, // 10MB limit per file
});

// ✅ Good: Use AbortController for long-running operations
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const result = await ls("", {
    maxDepth: Infinity,
    stat: true,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return result;
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Operation timed out");
  }
  throw error;
}
```

## Framework Integration

### React Hook

```ts
import { useEffect, useState } from 'react';
import { ls, formatTree } from '@pstdio/opfs-utils';

function useOPFSDirectory(path: string = '') {
  const [entries, setEntries] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initOPFS() {
      try {
        if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
          throw new Error('OPFS not supported');
        }

        await navigator.storage.getDirectory(); // Ensure OPFS is available
        const fileList = await ls('', { maxDepth: 2, stat: true });
        setEntries(formatTree(fileList));
      } catch (err) {
        setError(err.message);
      }
    }

    initOPFS();
  }, [path]);

  return { entries, error };
}

// Usage in component
function FileExplorer() {
  const { entries, error } = useOPFSDirectory();

  if (error) return <div>Error: {error}</div>;

  return (
    <pre>{entries || 'Loading...'}</pre>
  );
}
```

### Vue Composition API

```ts
import { ref, onMounted } from "vue";
import { ls, grep } from "@pstdio/opfs-utils";

export function useOPFS() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const searchFiles = async (pattern: string, includes: string[] = ["**/*"]) => {
    isLoading.value = true;
    try {
      const matches = await grep("", {
        pattern,
        flags: "i",
        include: includes,
      });
      return matches;
    } catch (err) {
      error.value = err.message;
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(async () => {
    try {
      await navigator.storage.getDirectory();
    } catch (err) {
      error.value = err.message;
    }
  });

  return {
    isLoading,
    error,
    searchFiles,
  };
}
```

## Security Considerations

### Safe File Operations

```ts
// ✅ Good: Validate file paths
function validateFilePath(path: string): boolean {
  // Prevent directory traversal
  if (path.includes("..") || path.startsWith("/")) {
    return false;
  }

  // Ensure reasonable path length
  if (path.length > 1000) {
    return false;
  }

  return true;
}

async function safeFileOperation(filePath: string) {
  if (!validateFilePath(filePath)) {
    throw new Error("Invalid file path");
  }

  return processSingleFileContent(filePath, "");
}
```

### Content Sanitization

```ts
import { processSingleFileContent, getSpecificMimeType } from "@pstdio/opfs-utils";

async function sanitizeFileContent(filePath: string) {
  const result = await processSingleFileContent(filePath, "");

  // For user-generated content, sanitize before display
  if ((getSpecificMimeType(filePath) || "").startsWith("text/html")) {
    // Use a sanitization library for HTML content
    result.llmContent = sanitizeHtml(String(result.llmContent));
  }

  return result;
}
```

## Migration & Compatibility

### Detecting OPFS Features

```ts
interface OPFSCapabilities {
  hasOPFS: boolean;
  hasDirectoryAccess: boolean;
  hasWriteAccess: boolean;
}

async function detectOPFSCapabilities(): Promise<OPFSCapabilities> {
  const capabilities: OPFSCapabilities = {
    hasOPFS: false,
    hasDirectoryAccess: false,
    hasWriteAccess: false,
  };

  // Check basic OPFS support
  if ("storage" in navigator && "getDirectory" in navigator.storage) {
    capabilities.hasOPFS = true;

    try {
      const root = await navigator.storage.getDirectory();
      capabilities.hasDirectoryAccess = true;

      // Test write access
      const testHandle = await root.getFileHandle("test-write", { create: true });
      const writable = await testHandle.createWritable();
      await writable.write("test");
      await writable.close();
      await root.removeEntry("test-write");

      capabilities.hasWriteAccess = true;
    } catch (error) {
      console.warn("OPFS write access not available:", error);
    }
  }

  return capabilities;
}
```

### Fallback Strategies

```ts
import { ls } from "@pstdio/opfs-utils";

async function getFileList(useOPFS: boolean = true) {
  if (useOPFS) {
    try {
      await navigator.storage.getDirectory();
      return await ls("");
    } catch (error) {
      console.warn("OPFS unavailable, falling back to alternative storage");
    }
  }

  // Fallback to IndexedDB or other storage mechanism
  return getFileListFromIndexedDB();
}

async function getFileListFromIndexedDB() {
  // Implement IndexedDB-based file listing as fallback
  return [];
}
```

---

## Requirements

- **Secure Context**: HTTPS or localhost required
- **Browser Support**: Modern browsers with OPFS implementation (see compatibility section)
- **Permissions**: User consent may be required for OPFS access
