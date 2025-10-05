## 1) Package purpose & build output

**Purpose**
Client‑only micro‑frontend runtime that:

- reads UI sources from configurable OPFS roots,
- compiles once per change via a single headless Sandpack,
- publishes compiled outputs to `/virtual/<hash>.js` (Service Worker cache),
- mounts MFEs in same‑origin sandboxed iframes,
- leaves **runtime HTML, providers, and dependencies** to the consumer.

**Build**
ESM + DTS via your Vite config (keep sourcemaps). Optionally externalize peer libs used in types only.

---

## 2) Public API (revised: no runtime/template assumptions)

```ts
// Paths are OPFS-style absolute POSIX (e.g. "/plugins/todos/ui")
export type Path = string;
export type MfeId = string;

export interface Lockfile {
  [specifier: string]: string; // e.g. { "react": "https://cdn.example.com/react@18.3.1" }
}

export interface InitOptions {
  serviceWorkerPath?: string; // default: "/kaset-sw.js"
  scope?: string; // default: "/" (must cover both runtime page and /virtual/* fetches)
}

/** Register SW (for /virtual/*) and internal state. */
export function init(opts?: InitOptions): Promise<void>;

/** Optional: store a lockfile used ONLY in hashing (never sent to runtimes). */
export function configureSharedDeps(lockfile: Lockfile): void;

/** Helper: wrap a lockfile (specifier -> resolved URL) into an import map JSON. */
export function buildImportMap(lockfile: Lockfile): { imports: Record<string, string> }; // intentionally flat; callers can extend for scopes

export interface SourceConfig {
  id: MfeId;
  root: Path; // e.g., "/plugins/todos/ui"
  entry?: Path; // default: `${root}/index.tsx` (must exist). Normalized to a path relative to `root` (e.g. `/plugins/todos/ui/index.tsx` → `/index.tsx`) before handing to Sandpack.
  tsconfigPath?: Path; // optional
  include?: RegExp[]; // default: include all under root
  exclude?: RegExp[]; // default: none
}

// During compilation we strip the `root` prefix from every discovered file so
// Sandpack sees project-relative module paths (always prefixed with `/`).

export function registerSources(configs: SourceConfig[]): void;
export function updateSource(config: SourceConfig): void;
export function removeSource(id: MfeId): void;
export function listSources(): SourceConfig[];
export function getSource(id: MfeId): SourceConfig | undefined;

export interface CompileParams {
  id: MfeId;
}
export interface CompileResult {
  id: MfeId;
  hash: string;
  url: `/virtual/${string}.js`;
  fromCache: boolean;
  bytes: number;
  assets: string[]; // extra files published alongside the main bundle (relative to /virtual/)
}
export function compileOrGet(p: CompileParams): Promise<CompileResult>;

export interface CreateMfeOptions {
  id: MfeId;
  /** Consumer-provided runtime page URL (must be same-origin) */
  runtimeUrl: string | ((id: MfeId) => string);

  /** What the runtime should call after importing the module */
  entryExport?: string; // default: "mount"
  mountSelector?: string; // default: "#root" (runtime may ignore if not applicable)

  /** What to send to the runtime */
  capabilities?: string[]; // host API names
  runtimeOptions?: unknown; // opaque blob passed through
  attributes?: Partial<HTMLIFrameElement>; // sizing, etc.

  /**
   * Import map to include in the init message.
   * - Provide the map explicitly per call (library does not read internal lockfile state).
   * - Omit to send none and let the runtime manage its own import map.
   */
  importMap?: { imports: Record<string, string> };
}

export interface MfeHandle {
  id: MfeId;
  iframe: HTMLIFrameElement;
  hash: string;
  reload(): Promise<void>; // re-snapshot, recompile if changed, re-init runtime with new URL
  destroy(): void;
}

export function createMfe(container: HTMLElement, opts: CreateMfeOptions): Promise<MfeHandle>;

/** Simple metrics for dashboards */
export function getStats(): {
  compiles: { total: number; cacheHits: number; avgMs: number };
  iframes: number;
  cache: { bundles: number };
};
```

---

## 3) Message protocol (runtime contract v1)

Because the **runtime page is consumer-owned**, we define a minimal, dependency‑free protocol.

### Init (host → runtime iframe)

```ts
type InitMessage = {
  type: "kaset:init";
  id: string; // MfeId
  moduleUrl: `/virtual/${string}.js`; // compiled output
  entryExport?: string; // e.g., "mount"
  mountSelector?: string; // e.g., "#root"
  importMap?: { imports: Record<string, string> } | undefined; // optional
  capabilities?: string[]; // host API names
  runtimeOptions?: unknown; // opaque context
};
```

**Runtime responsibilities (consumer):**

1. (Optional) If `importMap` is present and not already applied, inject:

   ```html
   <script type="importmap" id="kaset-importmap">
     {...}
   </script>
   ```

2. `const mod = await import(init.moduleUrl);`
3. Locate a container (e.g., `document.querySelector(init.mountSelector || '#root')`).
4. Call the chosen entry (by default `mod.mount(container, bridge, init.runtimeOptions)`), or ignore if your module self‑boots.
5. Send `kaset:ready` or `kaset:error` back to the host, and be prepared to process additional `kaset:init` messages on the same iframe (e.g. after `reload()`), re-importing the module as needed.

### Runtime → Host (status/events)

```ts
type ReadyMessage = { type: "kaset:ready"; id: string; meta?: any };
type ErrorMessage = { type: "kaset:error"; id: string; error: { message: string; stack?: string } };
type DisposeMessage = { type: "kaset:dispose"; id: string };
```

### Optional RPC (capability bridge)

You can:

- **Use your own** postMessage-based RPC in the runtime, or
- Import a tiny helper we export (no UI/deps assumed):
  - `import { createHostBridge } from "kaset-micro-ui/bridge/host";`
  - `import { createRuntimeBridge } from "kaset-micro-ui/bridge/runtime";`

These only handle request/response correlation and timeouts; you decide the method names and policies.

---

## 4) Repository / module layout (revised)

```
src/
  index.ts

  core/
    hash.ts               // sha256 over digests + entry + tsconfig + optional lockfile + toolchain versions
    idb.ts                // tiny metadata store (optional; lockfile, stats)
    cache.ts              // publishBundleToSW(), hasBundle(), bytes helpers (internal; library calls it)
    import-map.ts         // buildImportMap(lockfile) utility only (no DOM injection)

  opfs/
    fs.ts                 // enumerate/read OPFS via @pstdio/opfs-utils
    snapshot.ts           // readSnapshot(SourceConfig): ProjectSnapshot

  sandpack/
    manager.ts            // singleton headless Sandpack (react-ts template)
    compile.ts            // compileOrGet orchestrator + output capture (js/css/assets)

  host/
    sources.ts            // register/update/remove/list/get sources
    mfe-manager.ts        // createMfe(), reload(), destroy(); iframe creation + init message

  bridge/
    protocol.ts           // TS types for messages
    runtime.ts            // (optional) createRuntimeBridge() export (for consumers to import)
    host.ts               // (optional) createHostBridge() export (used by library + available to consumers)

  sw/
    sw.ts                 // Service Worker: serves CacheStorage for /virtual/*
```

> **Removed:** `runtime.html`, `bootstrap.ts`, `chakra.tsx`.
> **SW scope (default):** `/` so the worker controls host + runtime + /virtual/\* (fetch handler still only responds to `/virtual/`).

---

## 5) Initialization flow

1. `init()`:
   - Register SW (`/kaset-sw.js`, scope default `/`) and await `navigator.serviceWorker.ready`. Consumers who want tighter control can lower the scope, but it must cover the runtime page and `/virtual/*` fetches so bundle imports resolve.
   - Initialize metrics and internal state.

2. (Optional) `configureSharedDeps(lockfile)`:
   - Store lockfile in memory/IDB; included in the **build hash** to ensure correctness when shared deps change.
   - Not used to inject import maps—callers must pass maps explicitly when creating MFEs.

3. Consumers handle their **own import map** and runtime hosting.

---

## 6) Snapshot & hashing

**Snapshot** (`opfs/snapshot.ts`)

- Walk `source.root` (include/exclude).
- Read file contents into `files: Record<string, string>` keyed by `root`-relative paths (always prefixed with `/`).
- Compute `digests: Record<string, string>` (per-file SHA-256) using the same relative keys.
- Optionally read `tsconfigPath`.
- Derive `entryRelative` by stripping `root` from the resolved entry path (default `/index.tsx`).

**Hash**

```ts
hash = sha256({
  id,
  root,
  entryRelPath,
  digests,
  tsconfig: normalizedTsconfig,
  lockfile: configuredLockfileOrNull, // only if provided via configureSharedDeps()
  compilerVersion: "sandpack@X.Y",
});
```

No preprocessing; no dependency rewrites.

---

## 7) Compilation pipeline

1. Resolve `SourceConfig` by `id`.
2. Read snapshot.
3. Compute hash; check CacheStorage (`mfe-bundles-v1`) for `/virtual/<hash>.js`:
   - if hit → return URL.

4. If another compile for the same hash is already running, await its result; otherwise acquire the single Sandpack lock.
5. Sandpack:
   - `updateFiles(snapshot.files, { replace: true })` // expects the root-stripped keys (e.g. `/index.tsx`)
   - `run({ entry: snapshot.entryRelative })`
   - wait for `compileSuccess` and collect **all** outputs: each module's transpiled JS, emitted CSS, and `success.dependencies` assets.
   - normalize output paths (always leading `/`) and rewrite any absolute asset references in JS/CSS to point at `/virtual/<hash>/...`.

6. Publish to CacheStorage (library calls `publishBundleToSW()` internally):
   - `/virtual/<hash>.js` for the entry bundle (rewritten code).
   - `/virtual/<hash>/<normalized path>` for every secondary asset (CSS chunks, images, maps, etc.).

7. Return `{ id, hash, url, fromCache, bytes, assets }`, where `assets` is an array of published secondary URLs (paths relative to `/virtual/`).

---

## 8) Service Worker

- **Caches:** `mfe-bundles-v1` only.
- **Fetch handler:** responds to requests whose path starts with `/virtual/` by returning the cached Response. The entry bundle may fan out to `/virtual/<hash>/<asset>`, so everything lives under the same prefix. No network fallback (the library publishes compiled modules via `publishBundleToSW()` during compilation, consumers do not call it directly).
- **Activation:** claim clients and remove old bundle caches with version mismatch.

> The SW is intentionally generic—no assumptions about import maps or runtime HTML.

---

## 9) Iframe lifecycle (`createMfe`)

- Resolve/compile to get `{ hash, url }`.
- Compute `runtimeUrl` (fn or string).
- Create iframe:

  ```html
  <iframe
    src="{runtimeUrl}"
    sandbox="allow-scripts allow-same-origin"
    referrerpolicy="no-referrer"
    loading="lazy"
  ></iframe>
  ```

- When `load` fires, send the **InitMessage** with:
  - `moduleUrl: '/virtual/<hash>.js'`
  - `entryExport`, `mountSelector`
  - `capabilities`, `runtimeOptions`
  - optional `importMap` (see API)

- Listen for `kaset:ready` / `kaset:error`.
- `reload()` re-runs snapshot/hash; if changed, re-send init with the new URL (or recreate the iframe if your runtime prefers a hard reload). Runtime pages must treat a repeated `kaset:init` as a signal to re-import the module and remount.
- `destroy()` tears down listeners and removes the iframe.

---

## 10) Performance & scheduling

- Single Sandpack instance guarded by a lock (one compile at a time).
- Deduplicate in‑flight builds by `hash`.
- Optional prefetch: when an MFE is near viewport, call `compileOrGet({ id })`.
- Encourage lazy iframe creation for pages that may reach 50 MFEs.

---

## 11) Security posture

- **Same-origin sandboxed iframes** (`allow-scripts allow-same-origin` only).
- Runtime’s CSP is **consumer‑controlled** (library does not inject).
- Optional capability bridge with timeouts/rate limits (host side).

---

## 12) Example (host side)

```ts
import { init, configureSharedDeps, buildImportMap, registerSources, compileOrGet, createMfe } from "kaset-micro-ui";

await init({ serviceWorkerPath: "/kaset-sw.js" });

const lockfile = {
  react: "/vendor/react@18.3.1.js",
  "react-dom": "/vendor/react-dom@18.3.1.js",
  "@chakra-ui/react": "/vendor/@chakra-ui/react@2.8.2.js",
  "@emotion/react": "/vendor/@emotion/react@11.13.0.js",
  "@emotion/styled": "/vendor/@emotion/styled@11.13.0.js",
  "framer-motion": "/vendor/framer-motion@11.0.0.js",
  zustand: "/vendor/zustand@4.5.2.js",
  "@pstdio/opfs-utils": "/vendor/@pstdio/opfs-utils@0.1.5.js",
};

configureSharedDeps(lockfile);

// Consumer hosts their own runtime page at /runtimes/mfe.html (same origin)
const importMap = buildImportMap(lockfile);

registerSources([{ id: "todos", root: "/plugins/todos/ui", entry: "/plugins/todos/ui/main.tsx" }]);

// Optionally warm the cache
await compileOrGet({ id: "todos" });

const handle = await createMfe(document.querySelector("#slot")!, {
  id: "todos",
  runtimeUrl: "/runtimes/mfe.html",
  importMap, // include in init message (runtime will inject explicitly provided map)
  entryExport: "mount",
  mountSelector: "#root",
  capabilities: ["ui.openModal", "storage.getItem", "storage.setItem"],
});
```
