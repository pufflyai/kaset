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

// Get OPFS root directory
const root = await navigator.storage.getDirectory();

// List files and directories
const entries = await ls(root, {
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

const root = await navigator.storage.getDirectory();

// Search for "TODO" in TypeScript and Markdown files
const matches = await grep(root, {
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

const root = await navigator.storage.getDirectory();

// Safely read a file with automatic type detection
const result = await processSingleFileContent(
  "src/index.ts", // File path
  "", // Root directory (empty for OPFS root)
  root, // Directory handle
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

const root = await navigator.storage.getDirectory();

// Apply a unified diff
const diff = `--- a/hello.txt
+++ b/hello.txt
@@ -1 @@
-Hello
+Hello world`;

const result = await patch({
  root,
  diffContent: diff,
});

if (result.success) {
  console.log(`Modified ${result.details.modified.length} files`);
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

### `ls(dirHandle, options?)` → `Promise<LsEntry[]>`

List files and directories under an OPFS directory handle with powerful filtering and sorting capabilities.

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
  path: string; // POSIX-style path relative to dirHandle
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
const jsFiles = await ls(root, {
  include: ["**/*.js", "**/*.ts"],
  stat: true,
  sortBy: "size",
  sortOrder: "desc",
});

// Stream large directory listings
await ls(root, {
  maxDepth: Infinity,
  onEntry: (entry) => {
    if (entry.kind === "file" && entry.size > 1000000) {
      console.log(`Large file: ${entry.path} (${entry.size} bytes)`);
    }
  },
});

// Find all hidden directories
const hiddenDirs = await ls(root, {
  maxDepth: 3,
  showHidden: true,
  kinds: ["directory"],
  exclude: ["**/.git/**"],
});
```

### `grep(dirHandle, options)` → `Promise<GrepMatch[]>`

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
const todos = await grep(root, {
  pattern: /TODO|FIXME|XXX/i,
  include: ["**/*.ts", "**/*.js", "**/*.tsx"],
  exclude: ["**/node_modules/**", "**/dist/**"],
});

// Search with streaming for large codebases
await grep(root, {
  pattern: "function.*async",
  flags: "g",
  include: ["**/*.js"],
  onMatch: (match) => {
    console.log(`Async function at ${match.file}:${match.line}`);
  },
});

// Case-sensitive search in documentation
const apiRefs = await grep(root, {
  pattern: "API",
  include: ["**/*.md", "**/*.txt"],
  maxFileSize: 1024 * 1024, // 1MB limit
});
```

### `processSingleFileContent(filePath, rootDirectory, dirHandle, offset?, limit?)`

Safely read and process a single file with intelligent type detection and safety limits.

```ts
interface ProcessedFileReadResult {
  llmContent: string; // Processed content safe for LLM consumption
  returnDisplay: string; // Human-readable display format
  isTruncated: boolean; // Whether content was truncated
  mimeType?: string; // Detected MIME type
  size?: number; // File size in bytes
  encoding?: string; // Text encoding used
  error?: string; // Error message if processing failed
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
  root,
  0, // Start from beginning
  100, // Max 100 lines
);

if (config.mimeType === "application/json") {
  const data = JSON.parse(config.llmContent);
}

// Read a large log file with offset
const logs = await processSingleFileContent(
  "logs/app.log",
  "",
  root,
  1000, // Start from line 1000
  500, // Read 500 lines
);

// Handle different file types
const media = await processSingleFileContent("images/logo.png", "", root);
// For binary files, returns base64 inline data URL
console.log(media.llmContent); // "data:image/png;base64,..."
```

### `patch({ root, workDir?, diffContent, signal?, git? })`

Apply unified diff patches to OPFS files with optional git staging support.

```ts
interface PatchOptions {
  root: FileSystemDirectoryHandle; // OPFS root directory
  workDir?: string; // Subdirectory to work in
  diffContent: string; // Unified diff content
  signal?: AbortSignal; // Cancellation support
  git?: {
    // Optional git integration
    fs: any; // isomorphic-git fs interface
    dir: string; // Git repository directory
    stage?: boolean; // Stage changes after applying
  };
}

interface PatchResult {
  success: boolean; // Overall operation success
  output: string[]; // Operation log messages
  details: {
    created: string[]; // Files created
    modified: string[]; // Files modified
    deleted: string[]; // Files deleted
    renamed: string[]; // Files renamed
    failed: string[]; // Operations that failed
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

const result = await patch({
  root,
  diffContent: diff,
});

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

await patch({ root, diffContent: createDiff });

// Delete a file via patch
const deleteDiff = `--- a/old-file.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-Old content
-To be removed`;

await patch({ root, diffContent: deleteDiff });
```

### `formatTree(entries)` → `string`

Convert an array of `LsEntry` objects into a pretty-printed directory tree.

```ts
// Simple tree formatting
const entries = await ls(root, { maxDepth: 2 });
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

## Real-World Usage Patterns

### Building a Code Editor

```ts
import { ls, grep, processSingleFileContent, patch } from "@pstdio/opfs-utils";

class OPFSCodeEditor {
  constructor(private root: FileSystemDirectoryHandle) {}

  // File explorer functionality
  async getProjectStructure(projectPath: string = "") {
    const entries = await ls(this.root, {
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
    return grep(this.root, {
      pattern: query,
      flags: "i",
      include: ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx"],
      exclude: ["**/node_modules/**"],
    });
  }

  // Load file for editing
  async loadFile(filePath: string) {
    return processSingleFileContent(filePath, "", this.root);
  }

  // Apply code changes via diff
  async applyChanges(diffContent: string) {
    return patch({ root: this.root, diffContent });
  }
}
```

### Documentation Site Generator

```ts
import { ls, processSingleFileContent, formatTree } from "@pstdio/opfs-utils";

async function generateDocsSiteMap(root: FileSystemDirectoryHandle) {
  // Find all markdown files
  const entries = await ls(root, {
    maxDepth: Infinity,
    include: ["**/*.md"],
    exclude: ["**/node_modules/**"],
    stat: true,
  });

  const siteMap = [];

  for (const entry of entries) {
    const content = await processSingleFileContent(
      entry.path,
      "",
      root,
      0,
      50, // Just first 50 lines for metadata
    );

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

async function analyzeLogs(root: FileSystemDirectoryHandle) {
  // Find error patterns in log files
  const errors = await grep(root, {
    pattern: /ERROR|FATAL|CRITICAL/i,
    include: ["**/*.log", "**/logs/**/*.txt"],
    onMatch: (match) => {
      console.log(`🚨 ${match.file}:${match.line} - ${match.lineText}`);
    },
  });

  // Get log file statistics
  const logFiles = await ls(root, {
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
    const root = await navigator.storage.getDirectory();
    const entries = await ls(root);
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
async function safeFileRead(filePath: string, root: FileSystemDirectoryHandle) {
  try {
    const result = await processSingleFileContent(filePath, "", root);

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
    const results = await grep(root, {
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
const jsFiles = await ls(root, {
  include: ["**/*.js", "**/*.ts"],
  maxDepth: 3, // Limit depth if possible
});

// ❌ Bad: Scan entire file system
const allFiles = await ls(root, { maxDepth: Infinity });
```

### Efficient Text Search

```ts
// ✅ Good: Use streaming for large searches
const matches = [];
await grep(root, {
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
await grep(root, {
  pattern: "config",
  maxFileSize: 1024 * 1024, // 1MB limit
  concurrency: 2, // Reduce concurrency for large files
});
```

### Memory Management

```ts
// ✅ Good: Process files in batches
async function processLargeDirectory(root: FileSystemDirectoryHandle) {
  const BATCH_SIZE = 100;
  let processed = 0;

  await ls(root, {
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
await grep(root, {
  pattern: "search term",
  concurrency: 4, // Reasonable concurrency
  maxFileSize: 10 * 1024 * 1024, // 10MB limit per file
});

// ✅ Good: Use AbortController for long-running operations
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

try {
  const result = await ls(root, {
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
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [entries, setEntries] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initOPFS() {
      try {
        if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
          throw new Error('OPFS not supported');
        }

        const rootHandle = await navigator.storage.getDirectory();
        setRoot(rootHandle);

        const fileList = await ls(rootHandle, { maxDepth: 2, stat: true });
        setEntries(formatTree(fileList));
      } catch (err) {
        setError(err.message);
      }
    }

    initOPFS();
  }, [path]);

  return { root, entries, error };
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
  const root = ref<FileSystemDirectoryHandle | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const searchFiles = async (pattern: string, includes: string[] = ["**/*"]) => {
    if (!root.value) return [];

    isLoading.value = true;
    try {
      const matches = await grep(root.value, {
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
      root.value = await navigator.storage.getDirectory();
    } catch (err) {
      error.value = err.message;
    }
  });

  return {
    root: readonly(root),
    isLoading: readonly(isLoading),
    error: readonly(error),
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

async function safeFileOperation(filePath: string, root: FileSystemDirectoryHandle) {
  if (!validateFilePath(filePath)) {
    throw new Error("Invalid file path");
  }

  return processSingleFileContent(filePath, "", root);
}
```

### Content Sanitization

```ts
import { processSingleFileContent } from "@pstdio/opfs-utils";

async function sanitizeFileContent(filePath: string, root: FileSystemDirectoryHandle) {
  const result = await processSingleFileContent(filePath, "", root);

  // For user-generated content, sanitize before display
  if (result.mimeType === "text/html") {
    // Use a sanitization library for HTML content
    result.llmContent = sanitizeHtml(result.llmContent);
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
      const root = await navigator.storage.getDirectory();
      return await ls(root);
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
