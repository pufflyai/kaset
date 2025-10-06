# @pstdio/tiny-ui — Technical Specification (v0.1.0)

**Package:** `@pstdio/tiny-ui`
**Status:** REVIEW
**Created:** 2025-10-06
**Scope:** Client‑only micro‑frontend (MFE) runtime that compiles UI sources from OPFS using an in‑browser builder, publishes compiled artifacts to a same‑origin Service Worker cache under `/virtual/*`, and mounts MFEs into **package‑owned** sandboxed iframes.
**Last Updated:** 2025-10-06

> This specification **describes exactly what the current implementation does**, including limitations and non‑implemented features that are declared in types. Normative key words **MUST**, **SHOULD**, **MAY**, etc., indicate intent; when intent conflicts with code, the code wins and the spec calls that out explicitly.

---

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Non-Goals](#non-goals)
4. [Definitions & Acronyms](#definitions--acronyms)
5. [Assumptions](#assumptions)
6. [Constraints](#constraints)
7. [System Context](#system-context)
8. [Requirements](#requirements)
   8.1. [Functional Requirements](#functional-requirements)
   8.2. [Non-Functional Requirements](#non-functional-requirements)
9. [Interfaces](#interfaces)
   9.1. [Public APIs](#public-apis)
   9.2. [Data Contracts / Schemas](#data-contracts--schemas)
   9.3. [CLI / Batch Interfaces](#cli--batch-interfaces)
   9.4. [Events / Messaging](#events--messaging)
10. [Architecture](#architecture)
    10.1. [Components](#components)
    10.2. [Data Flow](#data-flow)
    10.3. [Deployment Topology](#deployment-topology)
    10.4. [State & Persistence](#state--persistence)
11. [Workflows](#workflows)
    11.1. [Sequence Diagrams](#sequence-diagrams)
    11.2. [State Machines](#state-machines)
12. [Error Handling & Failure Modes](#error-handling--failure-modes)
13. [Security & Privacy](#security--privacy)
14. [Performance & Scalability](#performance--scalability)
15. [Reliability, Availability & Observability](#reliability-availability--observability)
16. [Deployment & Operations](#deployment--operations)
17. [Testing & Validation](#testing--validation)
18. [Risks & Mitigations](#risks--mitigations)
19. [Alternatives Considered](#alternatives-considered)
20. [Limitations & Known Issues](#limitations--known-issues)
21. [Open Questions](#open-questions)
22. [Appendix](#appendix)
23. [Changelog](#changelog)

---

## Overview

**@pstdio/tiny-ui** is a **browser‑only** micro‑frontend runtime. It reads UI sources from **OPFS** (Origin Private File System), **builds once per change** with a **single headless esbuild‑wasm instance** running in a Web Worker, then **publishes static ESM (and optional CSS)** into a **Service Worker** cache under content‑addressed URLs:

- `/virtual/<hash>.js` (entry ESM)
- `/virtual/<hash>.js.map` (sourcemap)
- `/virtual/<hash>.css` (optional)

MFEs mount into **package‑owned** same‑origin sandboxed iframes whose HTML is **generated and cached** by the library (served from `/tiny-ui/iframe.html` by the Service Worker). The runtime document has no framework/dependency assumptions; the library injects import maps and styles as needed.

---

## Goals

- **Compile once per change; run from cache thereafter.**
- **Static outputs** for instant cold start and offline execution.
- **Library‑owned runtime iframe HTML** to avoid consumer hosting and ensure SW control.
- **Minimal API & protocol** for v1; no RPC layer, no code splitting, no assets beyond CSS.
- **Safety:** sandboxed iframes, same‑origin, zero server dependencies.

---

## Non-Goals

- Providing framework runtimes (React providers, routers, design systems).
- Cross‑origin MFEs.
- Full type‑checking; v1 is transpile/bundle only.
- Emitting arbitrary static assets (images/fonts) — **v1 supports CSS only**.
- Complex builder configuration (targets, minification flags, code splitting).

---

## Definitions & Acronyms

- **OPFS** — Origin Private File System.
- **SW** — Service Worker.
- **IDB** — IndexedDB.
- **MFE** — Micro‑frontend.
- **Lockfile** — Map `specifier → URL` for shared dependencies (also used to build import maps).

---

## Assumptions

- Browser supports **Service Workers**, **ES modules**, **postMessage**, and **OPFS**.
- SW scope covers both `/tiny-ui/iframe.html` and `/virtual/*` (default scope `/`).
- Page runs on a secure context (HTTPS) for SW/OPFS.

---

## Constraints

- **Builder:** esbuild‑wasm in a dedicated Worker.
- **Output:** Single JS file + optional single CSS file. **No JS code splitting in v1.**
- **Assets:** No non‑CSS assets emitted in v1.
- **Import maps:** Built automatically from the configured lockfile and injected by the runtime iframe.

---

## System Context

The host page imports `@pstdio/tiny-ui`, registers source roots pointing to OPFS, asks the library to create an MFE in a container, and the library:

1. Compiles sources with esbuild‑wasm (Worker).
2. Publishes artifacts to the SW cache under `/virtual/*`.
3. Creates a sandboxed iframe pointed at `/tiny-ui/iframe.html`.
4. Sends an init message with the module URL, optional CSS, and runtime options.
5. The runtime iframe injects the import map, loads the module, and mounts.

---

## Requirements

### Functional Requirements

**FR‑1 Initialization**

- `init()` **MUST** register the SW at `serviceWorkerPath` (default `/kaset-sw.js`) with `scope` (default `/`) and await `navigator.serviceWorker.ready`.
- On first `init()` after activation, the library **MUST** publish the **runtime iframe HTML** into the SW cache as `/tiny-ui/iframe.html` so the iframe is a **controlled client**.

**FR‑2 Shared Dependencies**

- `configureSharedDeps(lockfile)` **MUST** persist the lockfile (IDB + memory).
- The current lockfile **MUST** be:
  - included in the bundle hash; and
  - used to build the import map automatically for the runtime iframe.

**FR‑3 Source Registration**

- Manage `SourceConfig` entries keyed by `id`.
- Default `entry` is `${root}/index.tsx` and **MUST** exist.

**FR‑4 Snapshot & Hash**

- Snapshot **MUST** walk `root`, apply include/exclude, read files as UTF‑8.
- Keys **MUST** be root‑relative with leading `/`.
- Compute per‑file SHA‑256 and a composite hash (see [Data Contracts](#data-contracts--schemas)).

**FR‑5 Build**

- `compileOrGet({ id })` **MUST**:
  - Compute hash; check SW cache for `/virtual/<hash>.js`.
  - If miss: lock the single builder; run esbuild with:
    - `bundle: true`, `format: 'esm'`, `splitting: false`, `treeShaking: true`, `minify: false`, `sourcemap: true`.
    - Loaders: `.ts/.tsx` → ts/tsx; `.css` → css (extracted).
    - Treat **all keys in the lockfile** as `external` (resolve via import map).
    - Respect provided `tsconfigPath` via `tsconfigRaw`.

  - Publish to SW cache:
    - `/virtual/<hash>.js`
    - `/virtual/<hash>.js.map`
    - `/virtual/<hash>.css` (if css is emitted)

  - Return `CompileResult`.

**FR‑6 Serve from Cache**

- SW **MUST** intercept `GET` for:
  - `/virtual/*`
  - `/tiny-ui/iframe.html`

- Responses **MUST** come from CacheStorage bucket `tinyui-bundles-v1`. No network fallback.

**FR‑7 Iframe Lifecycle**

- `createMfe(container, opts)` **MUST**:
  - Ensure artifacts exist (`compileOrGet`).
  - Create `<iframe src="/tiny-ui/iframe.html" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" loading="lazy">`.
  - On `load`, post `kaset:init` with module URL and options (below).
  - Return a handle with `reload()` and `destroy()`.

- `reload()` **MUST** resnapshot and recompile if needed; then send a fresh `kaset:init` to the same iframe.

- `destroy()` **MUST** tear down listeners and remove the iframe.

**FR‑8 Stats**

- `getStats()` **MUST** expose `{ compiles: { total, cacheHits, avgMs }, iframes, cache: { bundles } }`.

### Non-Functional Requirements

- **NFR‑1 Latency:** First build per MFE ≤ 1500ms for ≤ 50 files / ≤ 150KB TS/TSX on modern laptops (excluding cold wasm init).
- **NFR‑2 Offline:** After first successful build & SW activation, MFEs **MUST** run offline.
- **NFR‑3 Determinism:** Same snapshot + lockfile + tool version → identical hash.
- **NFR‑4 Footprint:** Library host + SW ≤ 20KB gz (excluding wasm).
- **NFR‑5 Simplicity:** No optional RPC; no external asset pipeline.

---

## Interfaces

### Public APIs

```ts
// OPFS-style absolute POSIX paths (e.g. "/plugins/todos/ui")
export type Path = string;
export type MfeId = string;

export interface Lockfile {
  [specifier: string]: string; // e.g., { "react": "/vendor/react@18.3.1.js" }
}

export interface InitOptions {
  serviceWorkerPath?: string; // default: "/kaset-sw.js"
  scope?: string; // default: "/"
}

/** Register SW (for /virtual/* and /tiny-ui/iframe.html) and initialize internal state. */
export function init(opts?: InitOptions): Promise<void>;

/** Store shared deps lockfile; used in hashing AND to build the runtime import map. */
export function configureSharedDeps(lockfile: Lockfile): void;

/** Helper: convert lockfile to an import map JSON (flat). */
export function buildImportMap(lockfile: Lockfile): { imports: Record<string, string> };

export interface SourceConfig {
  id: MfeId;
  root: Path;
  entry?: Path; // default: `${root}/index.tsx`; normalized to root-relative "/index.tsx"
  tsconfigPath?: Path; // optional
  include?: RegExp[]; // default: include all under root
  exclude?: RegExp[]; // default: none
}

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
  css?: `/virtual/${string}.css`;
  assets: string[]; // v1: empty array (no non-CSS assets are emitted)
}
export function compileOrGet(p: CompileParams): Promise<CompileResult>;

export interface CreateMfeOptions {
  id: MfeId;

  /** Entry export to call after importing the module (default: "mount") */
  entryExport?: string;

  /** CSS selector inside the iframe document where the MFE should mount (default: "#root") */
  mountSelector?: string;

  /** Arbitrary options passed through to the MFE entry function */
  runtimeOptions?: unknown;

  /** Optional overrides for the created iframe element (size, classes, etc.) */
  attributes?: Partial<HTMLIFrameElement>;
}

export interface MfeHandle {
  id: MfeId;
  iframe: HTMLIFrameElement;
  hash: string;
  reload(): Promise<void>; // resnapshot, recompile if changed, re-init runtime with new URL
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

> **Differences vs earlier drafts:**
>
> - `runtimeUrl` was **removed**. The package owns and serves the iframe HTML at `/tiny-ui/iframe.html`.
> - The **lockfile feeds both hashing and the runtime’s import map**.
> - `assets` is an empty array in v1 (no non‑CSS assets).

### Data Contracts / Schemas

**Snapshot (internal):**

- `files: Record<string /* /relative */, string /* UTF-8 */>`
- `digests: Record<string, string /* sha256 hex */>`
- `entryRelative: string /* '/index.tsx' */`
- `tsconfig?: object`

**Bundle Hash Input:**

```ts
sha256({
  id,
  root,
  entryRelPath,
  digests, // sorted keys
  tsconfig: normalizedTsconfigOrNull,
  lockfile: configuredLockfileOrNull,
  compilerVersion: "esbuild@<x.y.z>",
});
```

**Cache Layout:**

- `/virtual/<hash>.js`
- `/virtual/<hash>.js.map`
- `/virtual/<hash>.css` (optional)
- `/tiny-ui/iframe.html` (runtime document)

### CLI / Batch Interfaces

None (browser‑only).

### Events / Messaging

**Message Protocol v1 (minimal):**

**Host → Runtime**

```ts
type InitMessage = {
  type: "tiny:init";
  id: string; // MfeId
  moduleUrl: `/virtual/${string}.js`;
  entryExport?: string; // default: "mount"
  mountSelector?: string; // default: "#root"
  runtimeOptions?: unknown; // opaque user data
  importMap: { imports: Record<string, string> }; // built from current lockfile
  styles?: string[]; // e.g., ["/virtual/<hash>.css"]
};
```

**Runtime responsibilities (package‑owned HTML implements these):**

1. If an import map with id `"tiny-importmap"` is not present, inject one from `init.importMap`.
2. If `styles` present, `<link rel="stylesheet" href="...">` for each missing entry.
3. `const mod = await import(init.moduleUrl)`; find container (`init.mountSelector` or `#root`).
4. Call the selected entry export (default `mod.mount(container, /*bridge*/ null, init.runtimeOptions)`).
5. Post `tiny:ready` or `tiny:error` to the parent; accept additional `tiny:init` for soft reloads.

**Runtime → Host**

```ts
type ReadyMessage = { type: "tiny:ready"; id: string; meta?: any };
type ErrorMessage = { type: "tiny:error"; id: string; error: { message: string; stack?: string } };
type DisposeMessage = { type: "tiny:dispose"; id: string };
```

> **Note:** No RPC/bridge is provided in v1.

---

## Architecture

### Components

```
src/
  index.ts                  // public API

  core/
    hash.ts                 // sha256 over digests + entry + tsconfig + lockfile + tool version
    idb.ts                  // minimal persistence (lockfile, stats)
    cache.ts                // publishToSW(), hasBundle(), byte accounting

  opfs/
    fs.ts                   // enumerate/read OPFS
    snapshot.ts             // readSnapshot(SourceConfig): ProjectSnapshot

  builder/
    worker.ts               // dedicated Worker hosting esbuild-wasm
    compile.ts              // orchestrates snapshot→build→publish

  host/
    sources.ts              // register/update/remove/list/get sources
    mfe-manager.ts          // createMfe(), reload(), destroy(); iframe creation + init message

  runtime/
    iframe-html.ts          // inline HTML string for /tiny-ui/iframe.html with init listener

  sw/
    sw.ts                   // Service Worker: serves /virtual/* and /tiny-ui/iframe.html from CacheStorage
```

### Data Flow

1. `init()` registers SW, waits ready, publishes `/tiny-ui/iframe.html` into the SW cache.
2. App `registerSources()`.
3. `createMfe()` → `compileOrGet(id)`:
   - Snapshot → hash → cache check → build (if miss) → publish.

4. Library creates iframe with `src="/tiny-ui/iframe.html"`.
5. On `load`, host posts `tiny:init` with `moduleUrl`, import map (from lockfile), and `styles`.
6. Runtime imports module, mounts, posts `tiny:ready`.

### Deployment Topology

- **Main Window** (host app)
- **Web Worker** (esbuild‑wasm builder)
- **Service Worker** (serves `/virtual/*` & `/tiny-ui/iframe.html`)
- **Iframe(s)** (one per MFE; same origin; controlled by SW)

### State & Persistence

- **OPFS:** source files (author content).
- **IDB:** current lockfile and basic stats (optional but enabled by default).
- **CacheStorage:** `tinyui-bundles-v1` for bundles and runtime HTML.

---

## Workflows

### Sequence Diagrams (text)

**W1 — First compile & mount**

1. `await init()` → SW ready; `/tiny-ui/iframe.html` cached.
2. `registerSources([{ id: "todos", root: "/plugins/todos/ui" }])`.
3. `createMfe(slot, { id: "todos" })`.
4. `compileOrGet("todos")` → build → publish `/virtual/<hash>.js` (+ `.css` if any).
5. Iframe loads `/tiny-ui/iframe.html`; host posts `tiny:init`.
6. Runtime injects import map (from lockfile), links CSS, `import(moduleUrl)`, calls `mount`, posts `tiny:ready`.

**W2 — Edit & reload**

1. OPFS sources change.
2. `handle.reload()` → snapshot + hash → build if needed → post new `tiny:init`.

### State Machines

**MFE Handle**

- `Idle` → (`createMfe`) → `LoadingFrame` → (`load`) → `InitSent` → (`tiny:ready`) → `Running`
- `Running` → (`reload`) → `InitSent`
- Any → (`destroy`) → `Disposed`

---

## Error Handling & Failure Modes

- **E_INIT_SW** — SW registration/ready failed → MFEs cannot mount.
- **E_OPFS_READ** — Snapshot failed (permissions or missing files) → build rejected.
- **E_BUILD_INIT** — wasm init failure (e.g., missing `/esbuild.wasm`) → build rejected.
- **E_BUILD_COMPILE** — esbuild diagnostics (syntax, missing module) → build rejected with diagnostics.
- **E_CACHE_PUBLISH** — CacheStorage write failed → compile rejected.
- **E_IFRAME_TIMEOUT** — Runtime did not reply `tiny:ready` within 15s → considered failed mount.
- **E_IMPORT_MAP** — Lockfile produces invalid import map (e.g., empty URLs) → runtime error surfaced as `tiny:error`.

**Reporting:**

- Promise rejections for host API; `tiny:error` for runtime failures (message contains stack/message).

---

## Security & Privacy

- Iframes are **same‑origin sandboxed**: `allow-scripts allow-same-origin`. No additional sandbox tokens.
- The runtime document performs **no cross‑origin fetches** by itself; module imports resolve to same‑origin `/virtual/*`.
- Import map is **inline** (no external fetch).
- Library **does not collect PII**; stats are local only.
- CSP: runtime HTML does **not** inject a CSP by default; it inherits site policy. Sites with restrictive CSPs must allow ESM `import` of `/virtual/*`.

---

## Performance & Scalability

- Single builder (Worker) with a lock; in‑flight deduplication by hash.
- First wasm init occurs on first build request; hosts MAY call `compileOrGet` early to warm.
- Sourcemaps are kept for debug; minification is disabled in v1.

---

## Reliability, Availability & Observability

- SW activates with `clients.claim()` and purges old caches on version mismatch (`tinyui-bundles-v1`).
- `getStats()` exposes counters (total builds, cache hits, avg ms, active iframes, bundle count).
- Minimal console logs under an internal debug toggle (not public API).

---

## Deployment & Operations

- Package build: **ESM + DTS** via Vite (sourcemaps kept).
- Peer dependencies used only in types SHOULD be externalized.
- Consumers must host:
  - `esbuild.wasm` at a stable URL (the Worker imports it).
  - The SW script (default `/kaset-sw.js`) produced by this package’s build output.

---

## Testing & Validation

- **Unit:** hashing determinism; snapshot include/exclude; import map generation; SW route matching.
- **Integration (browser):** end‑to‑end build→publish→iframe init→mount (with/without CSS); reload path; offline boot.
- **Perf:** first build and cache‑hit mount latency within NFRs.
- **Negative cases:** bad lockfile URL; missing entry file; OPFS permission denied; wasm missing.

**Acceptance highlights:**

- Unchanged sources → subsequent `compileOrGet` returns `{ fromCache: true }`.
- `.css` import emits `/virtual/<hash>.css` and runtime links it automatically.
- Offline after first build → `createMfe` mounts successfully.

---

## Risks & Mitigations

- **OPFS not available (Safari/Private mode):** Fail fast with explicit error; document fallback strategy (out of scope).
- **Wasm init latency:** Initialize Worker on first compile; users can warm via precompile.
- **CSP conflicts:** Document requirement to permit ESM imports from same origin.
- **No asset pipeline (images/fonts) in v1:** Defer; ensure clear error if imported.

---

## Alternatives Considered

1. **Sandpack as builder** — Not suited for portable static outputs; rejected.
2. **Server‑side bundling** — Conflicts with offline‑first/client‑only goals.
3. **SWC wasm** — Viable; esbuild chosen for simpler `build()` and CSS extraction.

---

## Limitations & Known Issues

- **No type checking** (transpile/bundle only).
- **No JS code splitting** (single ESM file).
- **No non‑CSS assets** (imports of images/fonts will error).
- **Import map only from lockfile** (per‑MFE overrides are not supported in v1).
- **Runtime HTML is fixed** (no user customization in v1).

---

## Open Questions

- Should v1.x add **optional per‑MFE import map extension** on `createMfe`?
- Do we need a **public builder config** (minify, targets), or keep it internal until v2?
- Would a **lightweight CSS auto‑remove on reload** (to prevent stale styles) be useful?

---

## Appendix

### Runtime iframe HTML (embedded)

The document is generated as a string and cached by the SW at `/tiny-ui/iframe.html` during `init()`.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>@pstdio/tiny-ui runtime</title>
    <style>
      html,
      body,
      #root {
        height: 100%;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      const ready = (id, meta) =>
        parent.postMessage({ type: "tiny:ready", id, meta }, "*");
      const err = (id, e) =>
        parent.postMessage({ type: "tiny:error", id, error: { message: e?.message || String(e), stack: e?.stack } }, "*");

      const ensureImportMap = (map) => {
        const id = "tiny-importmap";
        if (document.getElementById(id)) return;
        const s = document.createElement("script");
        s.type = "importmap"; s.id = id; s.textContent = JSON.stringify(map);
        document.head.appendChild(s);
      };

      const ensureStyles = (hrefs=[]) => {
        hrefs.forEach(href => {
          if (!href) return;
          if (!document.querySelector(\`link[rel="stylesheet"][href="\${href}"]\`)) {
            const l = document.createElement("link");
            l.rel = "stylesheet"; l.href = href;
            document.head.appendChild(l);
          }
        });
      };

      addEventListener("message", async (ev) => {
        const init = ev.data;
        if (!init || init.type !== "tiny:init") return;
        const id = init.id;
        try {
          ensureImportMap(init.importMap || { imports: {} });
          ensureStyles(init.styles || []);
          const mod = await import(init.moduleUrl);
          const mount = (init.entryExport && mod[init.entryExport]) || mod.mount;
          const container = document.querySelector(init.mountSelector || "#root") || document.body;
          if (typeof mount === "function") {
            await mount(container, null, init.runtimeOptions);
          }
          ready(id, { mounted: true });
        } catch (e) {
          err(id, e);
        }
      }, { passive: true });
    </script>
  </body>
</html>
```

### Example (host side)

```ts
import { init, configureSharedDeps, registerSources, compileOrGet, createMfe } from "@pstdio/tiny-ui";

await init({ serviceWorkerPath: "/kaset-sw.js" });

configureSharedDeps({
  react: "/vendor/react@18.3.1.js",
  "react-dom": "/vendor/react-dom@18.3.1.js",
});

registerSources([{ id: "todos", root: "/plugins/todos/ui", entry: "/plugins/todos/ui/main.tsx" }]);

// Optional warm-up
await compileOrGet({ id: "todos" });

const handle = await createMfe(document.querySelector("#slot")!, {
  id: "todos",
  entryExport: "mount",
  mountSelector: "#root",
  runtimeOptions: { theme: "light" },
});
```

---

## Changelog

- **2025-10-06 — v1.0.0 — Initial v1 spec for `@pstdio/tiny-ui`: library‑owned iframe HTML at `/tiny-ui/iframe.html`, esbuild‑wasm builder, static `/virtual/*` outputs (JS + optional CSS), minimal protocol, no code splitting or non‑CSS assets.**
