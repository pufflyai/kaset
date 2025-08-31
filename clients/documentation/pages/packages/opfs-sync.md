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

See the package README for full API and caveats.
