# @pstdio/opfs-sync

[![npm version](https://img.shields.io/npm/v/@pstdio/opfs-sync.svg?color=blue)](https://www.npmjs.com/package/@pstdio/opfs-sync)
[![license](https://img.shields.io/npm/l/@pstdio/opfs-sync)](https://github.com/pufflyai/core-utils/blob/main/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40pstdio%2Fopfs-sync)](https://bundlephobia.com/package/%40pstdio%2Fopfs-sync)

Small, dependency-light sync engine between the browser’s Origin Private File System (OPFS) and a remote storage provider. Ships with a Supabase Storage adapter and a minimal provider interface for custom backends.

Works entirely in the browser. Ideal for offline-first apps that keep a local OPFS workspace and reconcile with the cloud using a simple last-writer-wins strategy.

## Features

- Pluggable remote providers (Supabase adapter included)
- Last-writer-wins by mtime with optional sha256 equality short-circuit
- Evented progress reporting and error bubbling
- Periodic background scans (opt-in with `scanInterval`)
- Zero Node.js dependencies; ESM-only

## Installation

```bash
npm i @pstdio/opfs-sync
# If you plan to use the Supabase adapter:
npm i @supabase/supabase-js
```

Requirements:

- Runs in a secure context (https or localhost)
- Browser must implement the File System Access API (OPFS)

See MDN: https://developer.mozilla.org/docs/Web/API/File_System_Access_API

## Quick start

```ts
import { createClient } from "@supabase/supabase-js"; // only if using Supabase
import { OpfsSync, SupabaseRemote } from "@pstdio/opfs-sync";

// 1) Obtain an OPFS directory handle (root in this example)
const localDir = await navigator.storage.getDirectory();

// 2) Configure your remote (Supabase Storage)
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);
const remote = new SupabaseRemote(supabase, "my-bucket", "app/space/"); // optional prefix

// 3) Create the sync instance
const sync = new OpfsSync({ localDir, remote, scanInterval: 15_000 }); // 15s periodic scan

// 4) Listen to progress and errors (optional)
sync.addEventListener("progress", (e) => {
  const { phase, key, transferred, total } = (e as CustomEvent).detail;
  console.log(`[${phase}] ${key}: ${transferred}/${total}`);
});
sync.addEventListener("error", (e) => console.error("sync error", (e as CustomEvent).detail));

// 5) Run an initial reconciliation, then start watching
await sync.initialSync();
sync.startWatching();

// Later, to stop:
// sync.stopWatching();
```

## How it works

- The local OPFS tree is scanned and hashed (SHA-256 of file contents) with size and `lastModified` captured.
- The remote provider lists objects with size and modification time. If a remote `sha256` is provided, identical files are skipped.
- For each differing path, the newer side (by mtime) wins:
  - New local file → upload
  - New remote file → download
  - Both exist → last-writer-wins

This is a simple, pragmatic strategy; there’s no CRDT/merge or rename detection.

## API

### class OpfsSync

Constructor:

```ts
new OpfsSync(options: OpfsSyncOptions)
```

Options (`OpfsSyncOptions`):

- `localDir: FileSystemDirectoryHandle` — OPFS directory to sync
- `remote: RemoteProvider` — remote backend implementation
- `scanInterval?: number` — ms between periodic scans; `0` disables (default)
- `encryptionKey?: Uint8Array` — reserved for future use

Methods:

- `initialSync(): Promise<void>` — one-shot reconciliation pass
- `startWatching(): void` — begin periodic `initialSync()` on the interval
- `stopWatching(): void` — stop periodic scans

Events (dispatched on the `OpfsSync` instance):

- `progress` — `CustomEvent<ProgressEventDetail>` with `{ phase: "upload" | "download", key, transferred, total }`
- `error` — `CustomEvent<any>` — any error thrown by underlying operations

Types exported:

- `RemoteProvider`, `RemoteObject`, `OpfsSyncOptions`, `ProgressEventDetail`, `ProgressPhase`

### RemoteProvider interface

Implement to support a custom backend:

```ts
interface RemoteProvider {
  list(prefix: string): Promise<Array<{ key: string; size: number; mtimeMs: number; sha256?: string }>>;
  upload(key: string, data: Blob | ReadableStream): Promise<void>;
  download(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  updateAuth?(token?: string): void; // optional: rotate credentials
}
```

Contract notes:

- `list("")` should return a flat list of objects under the configured remote root.
- `mtimeMs` must be milliseconds since epoch. If your backend lacks precise mtimes, approximate consistently.
- If you can compute and return `sha256`, identical files will be skipped even when mtimes differ.

### SupabaseRemote

Provided adapter for Supabase Storage buckets:

```ts
new SupabaseRemote(client: SupabaseClient, bucket: string, prefix?: string)
```

- `list()` walks the bucket under `prefix`, returning objects with size and `mtimeMs` from `updated_at`.
- `upload()` uses `upsert: true`.
- `download()` returns a `Blob`.
- `remove()` deletes a single key.
- `updateAuth(token?)` can rotate a JWT if you need to refresh credentials.

## Common patterns

- Prompt user to pick a subdirectory under OPFS:

  ```ts
  const root = await navigator.storage.getDirectory();
  const projects = await root.getDirectoryHandle("projects", { create: true });
  const localDir = await projects.getDirectoryHandle("my-app", { create: true });
  ```

- Reactivity: wire `progress` to your UI and debounce totals for smooth updates.

- Auth refresh: call `remote.updateAuth(newAccessToken)` on token refresh.

## Caveats

- Last-writer-wins can overwrite changes if clocks skew or edits race. Consider adding conflict markers in your app layer if needed.
- No rename/move detection; renames appear as delete+create.
- Full-content hashing happens locally; large trees may be slow on initial pass.
- OPFS availability and quotas vary by browser; handle permission prompts gracefully.

## Testing

This package uses Vitest. From the package folder:

```bash
npm test
```

## License

MIT © Pufflig AB
