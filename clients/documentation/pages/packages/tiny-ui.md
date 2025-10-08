---
title: "@pstdio/tiny-ui"
---

# @pstdio/tiny-ui

**Browser-first plugin runtime for sandboxed micro frontends.**

Compile OPFS-backed sources with `esbuild-wasm`, cache bundles in a service worker, and expose audited host capabilities to plugin iframes.

---

## Install

```bash
npm i @pstdio/tiny-ui
```

---

## Why Tiny UI?

- Build and ship third-party plugin UIs entirely in the browser—no server build step required.
- Publish compiled bundles to the Cache API and serve them through a dedicated service worker + runtime iframe.
- Hand plugins a typed `host` bridge for filesystem, workspace reads, settings, and notifications through a single RPC surface.
- Reuse the Tiny Plugins lockfile/import-map tooling so bare specifiers resolve deterministically.

---

## Quick Start

### 1. Serve the runtime assets

Expose the runtime HTML and service worker from your app origin. With Vite (or any bundler that supports the `?url` suffix), you can import the asset URLs directly:

```ts
// host/bootstrap.ts
import runtimeUrl from "@pstdio/tiny-ui/dist/runtime.html?url";
import serviceWorkerUrl from "@pstdio/tiny-ui/dist/sw.js?url";

navigator.serviceWorker.register(serviceWorkerUrl).catch(console.error);
```

If your bundler cannot import assets as URLs, copy `dist/runtime.html` and `dist/sw.js` to `/tiny-ui/runtime.html` and `/tiny-ui-sw.js` in your public folder.

### 2. Register a virtual project snapshot

Load the plugin source tree (for example, from OPFS) and cache it with Tiny UI. The compile step reads this snapshot when it builds the bundle.

```ts
import { loadSourceFiles, compile, setLockfile } from "@pstdio/tiny-ui";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

const source = {
  id: "weather-ui",
  root: "/plugins/weather-ui",
  entrypoint: "/index.tsx",
};

await loadSourceFiles(source);

const result = await compile(source.id, {
  wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
});

console.log(result.hash, result.url, result.assets);
```

### 3. Render the React wrapper

```tsx
import { TinyUI } from "@pstdio/tiny-ui";

function PluginFrame() {
  return (
    <TinyUI
      id="weather-ui"
      root="/plugins/weather-ui"
      serviceWorkerUrl={serviceWorkerUrl}
      runtimeUrl={runtimeUrl}
      onReady={(result) => console.log("Bundle ready", result)}
      onError={(error) => console.error(error)}
    />
  );
}
```

- `id` is the stable bundle identifier Tiny UI uses when publishing and caching bundles—keep it unique per plugin.
- `root` is the same root path used in `loadSourceFiles`.
- Tiny UI auto-compiles when the service worker is ready. Call the imperative `rebuild()` handle to recompile on demand.

### 4. Bridge host capabilities (optional but recommended)

Pass `bridge` to `<TinyUI />` to allow plugins to talk to the host via `remote.ops`.

```tsx
import { createIframeOps, createWorkspaceFs } from "@pstdio/tiny-ui";

const bridge = {
  pluginsRoot: "/plugins",
  pluginId: "weather-ui",
  notify: (level, message) => console.info(`[${level}] ${message}`),
  workspaceFs: createWorkspaceFs("/workspace"),
};

<TinyUI
  id="weather-ui"
  root="/plugins/weather-ui"
  serviceWorkerUrl={serviceWorkerUrl}
  runtimeUrl={runtimeUrl}
  bridge={bridge}
/>;
```

Inside the iframe runtime, plugins receive a `host` object with:

- `host.fs.readFile/writeFile/ls/deleteFile/downloadFile`
- `host.workspace.read/readFile`
- `host.settings.read/write`
- `host.commands.notify`

All filesystem mutations are scoped to `/plugins/<pluginId>/data`, and workspace reads remain read-only.

---

## API Reference

### Core Components

- **`TinyUI(props)`** – React component that compiles snapshots and boots the runtime iframe. Accepts `bridge`, lifecycle callbacks, and `autoCompile`.
- **`TinyUIHandle`** – ref object exposing `rebuild()`.
- **`TinyUIStatus`** – status union (`"initializing" | "idle" | "compiling" | "ready" | "error"`).

### Snapshot Management

- **`registerVirtualSnapshot(root, snapshot)`** / **`unregisterVirtualSnapshot(root)`** – cache the in-memory file tree Tiny UI will compile.
- **`loadSourceFiles(source)`** – convenience helper that reads OPFS into a snapshot and registers it.

### Build & Compilation

- **`compile(id, options)`** – compile a registered snapshot using esbuild-wasm and cache the result.
- **`getCachedBundle(id)`** – retrieve a previously compiled bundle from cache.

### Lockfile & Import Maps

- **`setLockfile(lockfile)`** / **`getLockfile()`** – manage remote module metadata.
- **`buildImportMap(lockfile)`** – convert a lockfile into an import map for the runtime iframe.

### Low-Level Host Integration

- **`createTinyHost(iframe, id)`** – low-level host connector exposing `sendInit`, `onReady`, `onError`, `onOps`, and `disconnect`.
- **`createIframeOps(options)`** – build a typed `remote.ops` handler that wires scoped plugin storage, workspace reads, settings, and notifications.
- **`createWorkspaceFs(root)`** – wrap OPFS access for workspace reads.

### Constants

- **`CACHE_NAME`**, **`RUNTIME_HTML_PATH`**, **`VIRTUAL_PREFIX`** – constants that mirror the service worker config.

---

## Examples

### Load OPFS files once, reuse across reloads

```ts
import { loadSourceFiles, TinyUI, CACHE_NAME } from "@pstdio/tiny-ui";

async function bootPlugin() {
  await loadSourceFiles({
    id: "notepad",
    root: "/plugins/notepad",
    entrypoint: "/index.tsx",
  });

  render(
    <TinyUI
      id="notepad"
      root="/plugins/notepad"
      serviceWorkerUrl="/tiny-ui-sw.js"
      runtimeUrl="/tiny-ui/runtime.html"
    />
  );
}

async function invalidateBundles() {
  if (typeof caches === "undefined") return;
  await caches.delete(CACHE_NAME);
}
```

### Instant iframe boot from the cache manifest

If you previously compiled a plugin and the service worker still holds the bundle, you can skip `compile` entirely and boot straight from the cache manifest.

```ts
import { getCachedBundle, compile, createTinyHost } from "@pstdio/tiny-ui";

const pluginId = "sql-explorer";
const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, pluginId);

let result = await getCachedBundle(pluginId);

if (!result) {
  await loadSourceFiles({
    id: pluginId,
    root: "/plugins/sql-explorer",
    entrypoint: "/index.tsx",
  });

  result = await compile(pluginId, {
    wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
  });
}

await host.sendInit(result);
```

---

## Usage Notes

- The first compile downloads `esbuild-wasm` (≈1 MB); host environments can pass a custom `runtimeUrl` or `wasmURL` to point at a local mirror.
- Serve `runtime.html` and `sw.js` from the same origin as the iframe; cross-origin service workers are blocked by browsers.
- Snapshots must include the designated entry file. Tiny UI throws if the entry is missing so errors surface during development.
- Use `setLockfile()` to declare CDN-backed dependencies; the runtime injects the import map before loading the bundle. The lockfile is shared across all Tiny UI instances, so the latest call wins—merge specifiers when multiple plugins need different libraries.
- When running in non-OPFS browsers, build hosts can still register virtual snapshots by supplying file contents directly.

---

## Dependencies

- [@pstdio/opfs-utils](/packages/opfs-utils) - Core OPFS operations
- [@pstdio/tiny-plugins](/packages/tiny-plugins) - Plugin manifest and runtime
- `esbuild-wasm` - Browser-based bundling
- `react` - UI framework support

---

## See Also

- [@pstdio/tiny-plugins](/packages/tiny-plugins) - Plugin manifest and command execution
- [Plugins](/modifications/plugins) - Building plugins for Kaset
- [Live Playground](https://kaset.dev/playground) - Try plugin UIs in action
