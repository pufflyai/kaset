---
title: "@pstdio/opfs-sync"
---

# @pstdio/opfs-sync

A powerful browser-only synchronization engine that keeps your OPFS (Origin Private File System) directory in sync with remote storage providers. Built for modern web applications that need reliable file synchronization without server dependencies.

## Overview

`@pstdio/opfs-sync` provides bidirectional synchronization between the browser's OPFS and remote storage services. It features conflict resolution, progress tracking, and a pluggable provider system that makes it easy to integrate with different storage backends.

### Key Features

- **Bidirectional sync** - Keep local and remote files in perfect harmony
- **Conflict resolution** - Last-writer-wins strategy based on modification time
- **Progress tracking** - Real-time updates on upload/download operations
- **Pluggable providers** - Built-in Supabase adapter with interface for custom backends
- **Efficient transfers** - SHA256 checksums avoid unnecessary uploads
- **Background monitoring** - Automatic periodic scans for changes
- **Browser-native** - No Node.js dependencies, runs entirely in the browser

## Installation

```bash
npm i @pstdio/opfs-sync

# For Supabase integration
npm i @supabase/supabase-js
```

## Getting Started

### Basic Setup

Here's a complete example showing how to set up sync with Supabase Storage:

```ts
import { createClient } from "@supabase/supabase-js";
import { OpfsSync, SupabaseRemote } from "@pstdio/opfs-sync";

// Get the root OPFS directory
const localDir = await navigator.storage.getDirectory();

// Initialize Supabase client
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);

// Create remote provider
const remote = new SupabaseRemote(supabase, "my-bucket", "user-files/");

// Configure sync engine
const sync = new OpfsSync({
  localDir,
  remote,
  scanInterval: 30_000, // Check for changes every 30 seconds
});

// Listen for sync events
sync.addEventListener("progress", (e) => {
  const { phase, key, transferred, total } = (e as CustomEvent).detail;
  console.log(`${phase}: ${key} - ${transferred}/${total} bytes`);
});

sync.addEventListener("error", (e) => {
  console.error("Sync error:", (e as CustomEvent).detail);
});

// Perform initial sync and start monitoring
await sync.initialSync();
sync.startWatching();
```

### Working with Files

Once sync is configured, you can work with files normally through the OPFS API:

```ts
// Create a new file
const fileHandle = await localDir.getFileHandle("document.txt", { create: true });
const writable = await fileHandle.createWritable();
await writable.write("Hello, world!");
await writable.close();

// The file will be automatically synced to remote storage
// during the next scan cycle
```

### Manual Sync Operations

You can trigger synchronization manually at any time:

```ts
// Perform a full sync check
await sync.initialSync();

// Stop background monitoring
sync.stopWatching();

// Resume background monitoring
sync.startWatching();
```

## Advanced Usage

### Custom Remote Providers

Implement the `RemoteProvider` interface to integrate with any storage service:

```ts
import type { RemoteProvider, RemoteObject } from "@pstdio/opfs-sync";

class S3Remote implements RemoteProvider {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(client: S3Client, bucket: string, prefix: string = "") {
    this.client = client;
    this.bucket = bucket;
    this.prefix = prefix;
  }

  async list(prefix: string): Promise<RemoteObject[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: this.prefix + prefix,
    });

    const response = await this.client.send(command);

    return (response.Contents || []).map((obj) => ({
      key: obj.Key!.slice(this.prefix.length),
      size: obj.Size || 0,
      mtimeMs: obj.LastModified?.getTime() || 0,
      sha256: obj.ETag?.replace(/"/g, ""), // ETag often contains SHA256
    }));
  }

  async upload(key: string, data: Blob | ReadableStream): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + key,
      Body: data,
    });

    await this.client.send(command);
  }

  async download(key: string): Promise<Blob> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + key,
    });

    const response = await this.client.send(command);
    return new Blob([await response.Body!.transformToByteArray()]);
  }

  async remove(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + key,
    });

    await this.client.send(command);
  }
}

// Use your custom provider
const remote = new S3Remote(s3Client, "my-bucket", "app-data/");
const sync = new OpfsSync({ localDir, remote });
```

### Error Handling

Implement robust error handling for production applications:

```ts
const sync = new OpfsSync({ localDir, remote, scanInterval: 30_000 });

sync.addEventListener("error", (e) => {
  const error = (e as CustomEvent).detail;

  if (error.code === "NETWORK_ERROR") {
    // Handle network issues - maybe retry later
    console.warn("Network error during sync, will retry:", error.message);
    setTimeout(() => sync.initialSync(), 60_000); // Retry in 1 minute
  } else if (error.code === "PERMISSION_ERROR") {
    // Handle authentication issues
    console.error("Permission denied - check credentials");
    // Maybe redirect to login
  } else {
    // Log unexpected errors
    console.error("Unexpected sync error:", error);
  }
});
```

### Progress Monitoring

Track sync progress with detailed event handling:

```ts
let totalFiles = 0;
let completedFiles = 0;
const progressMap = new Map<string, { transferred: number; total: number }>();

sync.addEventListener("progress", (e) => {
  const { phase, key, transferred, total } = (e as CustomEvent).detail;

  // Track per-file progress
  progressMap.set(key, { transferred, total });

  // Calculate overall progress
  const overallTransferred = Array.from(progressMap.values()).reduce((sum, p) => sum + p.transferred, 0);
  const overallTotal = Array.from(progressMap.values()).reduce((sum, p) => sum + p.total, 0);

  const percentage = overallTotal > 0 ? (overallTransferred / overallTotal) * 100 : 0;

  updateProgressBar(percentage, `${phase}: ${key}`);
});

function updateProgressBar(percentage: number, currentFile: string) {
  // Update your UI here
  console.log(`${percentage.toFixed(1)}% - ${currentFile}`);
}
```

## API Reference

### OpfsSync Class

#### Constructor

```ts
new OpfsSync(options: OpfsSyncOptions)
```

**Options:**

- `localDir: FileSystemDirectoryHandle` - OPFS directory to sync
- `remote: RemoteProvider` - Remote storage provider implementation
- `scanInterval?: number` - Milliseconds between background scans (default: 0, disabled)
- `encryptionKey?: Uint8Array` - Optional encryption key for file contents

#### Methods

##### `initialSync(): Promise<void>`

Performs a complete synchronization between local and remote storage. Compares all files and transfers any that are different or missing.

```ts
await sync.initialSync();
```

##### `startWatching(): void`

Begins periodic background scanning based on the configured `scanInterval`. Does nothing if `scanInterval` is 0 or not set.

```ts
sync.startWatching();
```

##### `stopWatching(): void`

Stops background scanning. Safe to call multiple times.

```ts
sync.stopWatching();
```

#### Events

The `OpfsSync` class extends `EventTarget` and dispatches the following events:

##### Progress Event

```ts
sync.addEventListener("progress", (e: CustomEvent<ProgressEventDetail>) => {
  const { phase, key, transferred, total } = e.detail;
  // phase: "upload" | "download"
  // key: string (file path)
  // transferred: number (bytes completed)
  // total: number (total bytes)
});
```

##### Error Event

```ts
sync.addEventListener("error", (e: CustomEvent<any>) => {
  console.error("Sync error:", e.detail);
});
```

### RemoteProvider Interface

Implement this interface to create custom storage backends:

```ts
interface RemoteProvider {
  list(prefix: string): Promise<RemoteObject[]>;
  upload(key: string, data: Blob | ReadableStream): Promise<void>;
  download(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  updateAuth?(token?: string): void;
}

interface RemoteObject {
  key: string; // File path relative to provider root
  size: number; // File size in bytes
  mtimeMs: number; // Modification time in milliseconds since epoch
  sha256?: string; // Optional SHA256 hash for efficient comparison
}
```

**Implementation Notes:**

- `list("")` should return all files under the configured prefix
- `mtimeMs` should be consistent - if your backend doesn't support precise timestamps, use a consistent approximation
- `sha256` is optional but highly recommended for performance
- `updateAuth()` is called when authentication tokens need refreshing

### SupabaseRemote Class

Built-in adapter for Supabase Storage:

#### Constructor

```ts
new SupabaseRemote(client: SupabaseClient, bucket: string, prefix?: string)
```

**Parameters:**

- `client` - Initialized Supabase client
- `bucket` - Storage bucket name
- `prefix` - Optional path prefix for all operations (default: "")

#### Example Configuration

```ts
const supabase = createClient(url, anonKey);
const remote = new SupabaseRemote(supabase, "user-files", "documents/");

// Files will be stored at: user-files/documents/{filename}
```

## Best Practices

### Performance Optimization

**1. Use appropriate scan intervals**

```ts
// For real-time apps
const sync = new OpfsSync({ localDir, remote, scanInterval: 5_000 });

// For less critical sync
const sync = new OpfsSync({ localDir, remote, scanInterval: 60_000 });

// For manual sync only
const sync = new OpfsSync({ localDir, remote }); // scanInterval: 0
```

**2. Implement SHA256 checksums in custom providers**

```ts
// This prevents unnecessary uploads of identical content
async list(prefix: string): Promise<RemoteObject[]> {
  return files.map(file => ({
    key: file.path,
    size: file.size,
    mtimeMs: file.lastModified,
    sha256: file.checksum, // Include this when possible!
  }));
}
```

**3. Use appropriate prefixes to limit scope**

```ts
// Sync only user documents, not entire OPFS
const userDir = await localDir.getDirectoryHandle("documents");
const sync = new OpfsSync({ localDir: userDir, remote });
```

### Error Handling Strategies

**1. Implement retry logic for transient failures**

```ts
let retryCount = 0;
const MAX_RETRIES = 3;

sync.addEventListener("error", async (e) => {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(`Sync failed, retrying (${retryCount}/${MAX_RETRIES})...`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
    await sync.initialSync();
  } else {
    console.error("Sync failed after maximum retries");
    retryCount = 0; // Reset for next sync attempt
  }
});
```

**2. Handle authentication expiration**

```ts
sync.addEventListener("error", async (e) => {
  if (e.detail.code === "UNAUTHORIZED") {
    // Refresh authentication
    await refreshUserSession();
    remote.updateAuth?.(newToken);
    await sync.initialSync();
  }
});
```

### Security Considerations

**1. Validate file paths to prevent directory traversal**

```ts
function sanitizeFilePath(path: string): string {
  return path.replace(/\.\./g, "").replace(/^\/+/, "");
}
```

**2. Consider client-side encryption for sensitive data**

```ts
const encryptionKey = new Uint8Array(32); // Generate or derive securely
crypto.getRandomValues(encryptionKey);

const sync = new OpfsSync({
  localDir,
  remote,
  encryptionKey, // Files will be encrypted before upload
});
```

## Troubleshooting

### Common Issues

**Problem: Sync fails with "SecurityError"**

```
Solution: Ensure your app runs in a secure context (HTTPS or localhost)
```

**Problem: Files not syncing despite changes**

```
Solution: Check scanInterval setting and ensure startWatching() was called
```

**Problem: Large files fail to upload**

```
Solution: Check your remote provider's file size limits and timeout settings
```

**Problem: Slow initial sync on large file sets**

```
Solution: Consider reducing scope with directory handles or implementing progressive sync
```

### Debug Mode

Enable detailed logging during development:

```ts
const sync = new OpfsSync({ localDir, remote, scanInterval: 30_000 });

// Log all sync events
sync.addEventListener("progress", console.log);
sync.addEventListener("error", console.error);

// Add custom debug logging
const originalInitialSync = sync.initialSync.bind(sync);
sync.initialSync = async () => {
  console.log("Starting initial sync...");
  const start = Date.now();
  await originalInitialSync();
  console.log(`Initial sync completed in ${Date.now() - start}ms`);
};
```

## Browser Support

### Requirements

- **OPFS Support**: Chrome 86+, Firefox 111+, Safari 15.2+
- **Secure Context**: HTTPS or localhost required
- **ES Modules**: Modern bundler or native ES module support

### Feature Detection

```ts
function isOpfsSyncSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function" &&
    window.isSecureContext
  );
}

if (isOpfsSyncSupported()) {
  // Initialize sync
  const sync = new OpfsSync({ localDir, remote });
} else {
  console.warn("OPFS sync not supported in this environment");
  // Fallback to alternative storage strategy
}
```

## Migration Guide

### From localStorage/indexedDB

```ts
// Old approach with localStorage
const data = JSON.parse(localStorage.getItem("myData") || "{}");

// New approach with OPFS sync
const localDir = await navigator.storage.getDirectory();
const dataHandle = await localDir.getFileHandle("myData.json", { create: true });
const file = await dataHandle.getFile();
const data = JSON.parse(await file.text());

// Changes are automatically synced to remote storage
```

### From Manual File Upload/Download

```ts
// Old approach - manual upload
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  await fetch("/api/upload", { method: "POST", body: formData });
}

// New approach - automatic sync
const fileHandle = await localDir.getFileHandle(file.name, { create: true });
const writable = await fileHandle.createWritable();
await writable.write(file);
await writable.close();
// File is automatically synced to remote storage
```

## FAQ

**Q: Can I use this in a web worker?**
A: Yes, but ensure the worker has access to OPFS. Some browsers may have restrictions.

**Q: Does this work with React/Vue/Angular?**
A: Yes, `@pstdio/opfs-sync` is framework-agnostic. Just initialize it in your app startup.

**Q: Can I sync multiple directories?**
A: Create separate `OpfsSync` instances for each directory you want to sync.

**Q: How do I handle merge conflicts?**
A: The library uses last-writer-wins. For advanced conflict resolution, implement custom logic in your `RemoteProvider`.

**Q: Is there a size limit for files?**
A: Limits depend on your remote provider and browser. OPFS itself supports large files.

**Q: Can I pause/resume sync?**
A: Use `stopWatching()` and `startWatching()` to control background sync. Manual sync via `initialSync()` is always available.

## Contributing

See the [monorepo README](https://github.com/pufflyai/kaset#readme) for contribution guidelines.

## License

MIT © Pufflig AB
