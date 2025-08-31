# Core Utils Monorepo (@pstdio)

Utilities for building browser‑first apps with the Origin Private File System (OPFS), remote sync, prompt helpers, and repo description tooling.

- Node.js 22 is required (see `package.json` engines and Volta pin).

## Packages

- `@pstdio/opfs-utils` — OPFS helpers: ls/tree, grep, safe file reads (text/binary/SVG/PDF), and patch utilities.
- `@pstdio/opfs-sync` — Two‑way sync between an OPFS directory and a remote provider (includes a Supabase Storage remote).
- `@pstdio/prompt-utils` — Prompt and JSON utilities for LLM workflows (templating, safe stringify/parse, short IDs, hashing).
- `describe-context` — Analyze a folder and generate an LLM‑friendly markdown context (library + simple CLI).

## Quick start

1. Install dependencies (from repo root):

```bash
npm i
```

2. Build everything:

```bash
npm run build
```

3. Run tests:

```bash
npm run test
```

Useful root scripts:

- `npm run format` / `npm run format:check`
- `npm run lint`
- `npm run build` (lerna builds all)
- `npm run test` (lerna runs package tests)
- `npm run clean` (removes node_modules, dist, caches)
- `npm run reset:all` (clean → install → lint → build → test)

## Package usage

Below are minimal examples. These packages are intended for browser contexts unless noted.

### @pstdio/opfs-utils

Key exports:

- `ls(dirHandle, options)` — list files/dirs with filters, stats, and formatting helpers (`formatLong`, `formatTree`).
- `grep(dirHandle, options)` — stream‑friendly recursive search with include/exclude globs.
- `processSingleFileContent(filePath, rootDir, opfsRoot, offset?, limit?)` — read a single OPFS file, handling text/binary/SVG/PDF.
- `patch(...)` — apply patch in OPFS (see source for API details).

Example (browser):

```ts
import { ls, grep, processSingleFileContent } from "@pstdio/opfs-utils";

// OPFS root handle
const root = await navigator.storage.getDirectory();

// List files as a tree
const entries = await ls(root, { maxDepth: Infinity, stat: true });

// Grep for a pattern in text files
const matches = await grep(root, {
  pattern: /TODO:/i,
  exclude: ["**/node_modules/**", "**/dist/**"],
});

// Read a single file (first 2k lines by default)
const res = await processSingleFileContent("project/src/index.ts", "project", root);
console.log(res.returnDisplay);
```

### @pstdio/opfs-sync

Sync an OPFS directory against a remote. Includes `SupabaseRemote` for Supabase Storage.

Key exports: `OpfsSync`, `SupabaseRemote`, and types under `./src/types`.

Example (browser):

```ts
import { createClient } from "@supabase/supabase-js";
import { OpfsSync, SupabaseRemote } from "@pstdio/opfs-sync";

const localDir = await navigator.storage.getDirectory();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const remote = new SupabaseRemote(supabase, "my-bucket", "my/prefix/");

const sync = new OpfsSync({ localDir, remote, scanInterval: 30_000 });
sync.addEventListener("progress", (e: any) => console.log("progress", e.detail));
sync.addEventListener("error", (e: any) => console.error("sync error", e.detail));

await sync.initialSync();
sync.startWatching();
```

### @pstdio/prompt-utils

Prompt/JSON helpers for LLM workflows.

Key exports: `prompt`, `getSchema`, `parseJSONStream`, `safeStringify`, `safeParse`, `shortUID`, `hashString`.

Example:

```ts
import { prompt, getSchema, parseJSONStream, safeStringify, shortUID, hashString } from "@pstdio/prompt-utils";

const p = prompt`
	You are a helpful assistant.
	Answer briefly.
`;

const schema = getSchema({ id: 1, name: "Alice", flags: [true] });

const partial = '{"ok": true, "items": [1,2,3';
const parsed = parseJSONStream(partial); // -> { ok: true, items: [1,2,3] } or null

const id = shortUID("r"); // e.g., "r1ab2c"
const stable = safeStringify({ a: 2, b: "3" });
const h = hashString(p);
```

### @pstdio/describe

Analyze a folder and produce an LLM‑ready markdown context (directory tree + selected file contents).

Library usage:

```ts
import { generateContext } from "@pstdio/describe";

const { markdown, stats } = await generateContext("/path/to/folder");
console.log(markdown, stats);
```

CLI (after building this package via the monorepo build):

```bash
node packages/@pstdio/describe/dist/generate-context.js <folder> [output-file]
```

## Developing

- Build and test everything from the repo root using the scripts above.
- To target a single package, you can run through workspaces:

```bash
# Build a single workspace
npm run build --workspace @pstdio/opfs-utils

# Test a single workspace
npm run test --workspace @pstdio/opfs-sync
```

## Docs site

There is a VitePress documentation client under `clients/documentation/`.

```bash
# from repo root or within clients/documentation
npm run start --workspace documentation    # dev server
npm run build --workspace documentation    # static build
```

## License

See `LICENSE` for details.
