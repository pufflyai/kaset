---
title: "@pstdio/opfs-sync"
---

# @pstdio/opfs-sync

Browser-only sync engine between an OPFS directory and a remote storage provider. Ships with a Supabase Storage adapter and a minimal provider interface for custom backends.

## Install

```bash
npm i @pstdio/opfs-sync
# If using the Supabase adapter
npm i @supabase/supabase-js
```

## Quick start

```ts
import { createClient } from "@supabase/supabase-js";
import { OpfsSync, SupabaseRemote } from "@pstdio/opfs-sync";

const localDir = await navigator.storage.getDirectory();

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, import.meta.env.VITE_SUPABASE_ANON_KEY!);
const remote = new SupabaseRemote(supabase, "my-bucket", "app/space/");

const sync = new OpfsSync({ localDir, remote, scanInterval: 15_000 });
sync.addEventListener("progress", (e) => console.log("progress", (e as CustomEvent).detail));
sync.addEventListener("error", (e) => console.error("sync error", (e as CustomEvent).detail));

await sync.initialSync();
sync.startWatching();
```

## Features

- Pluggable remote providers (Supabase adapter included)
- Last-writer-wins by mtime with optional sha256 equality short-circuit
- Evented progress reporting and error bubbling
- Periodic background scans with `scanInterval`
- ESM-only; no Node.js deps

## RemoteProvider interface

```ts
interface RemoteProvider {
  list(prefix: string): Promise<Array<{ key: string; size: number; mtimeMs: number; sha256?: string }>>;
  upload(key: string, data: Blob | ReadableStream): Promise<void>;
  download(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  updateAuth?(token?: string): void;
}
```

Contract notes:

- list("") returns a flat list under the configured remote root/prefix
- mtimeMs is epoch ms; approximate consistently if backend lacks precise mtimes
- sha256 is optional but helps skip identical content even if mtimes differ

## API

class OpfsSync

- constructor(options: { localDir, remote, scanInterval?, encryptionKey? })
- initialSync(): `Promise<void>`
- startWatching(): void
- stopWatching(): void

Events dispatched on the instance:

- "progress" → `CustomEvent<{ phase: "upload"|"download"; key: string; transferred: number; total: number }>`
- "error" → `CustomEvent<any>`

### SupabaseRemote

Provided adapter: `new SupabaseRemote(client, bucket, prefix?)`

- list uses `updated_at` for mtimeMs; upload uses upsert; download returns Blob; remove deletes; updateAuth rotates JWT.

## Requirements

- Secure context (https or localhost)
- Browser support for OPFS

## Caveats

- Last-writer-wins can overwrite changes on clock skew or racing edits
- No rename detection (appears as delete+create)
- Initial hashing on large trees may be slow; consider narrowing scope
