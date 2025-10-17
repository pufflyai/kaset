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
- Hand plugins a typed `host` bridge through a single `onActionCall` RPC surface.
- Reuse the Tiny Plugins lockfile/import-map tooling so bare specifiers resolve deterministically.

---

## Quick Start

### 1. Serve the runtime assets

Expose the runtime HTML and service worker from your app origin. With Vite (or any bundler that supports the `?url` suffix), you can import the asset URLs directly:

```ts
// host/bootstrap.ts
import runtimeUrl from "@pstdio/tiny-ui/dist/runtime.html?url";
import serviceWorkerUrl from "@pstdio/tiny-ui-bundler/dist/sw.js?url";
import { setupTinyUI } from "@pstdio/tiny-ui";

void setupTinyUI({ runtimeUrl, serviceWorkerUrl }).catch(console.error);
```

If your bundler cannot import assets as URLs, copy `@pstdio/tiny-ui/dist/runtime.html` and `@pstdio/tiny-ui-bundler/dist/sw.js` to `/tiny-ui/runtime.html` and `/tiny-ui-sw.js`, then call `setupTinyUI({ runtimeUrl: "/tiny-ui/runtime.html", serviceWorkerUrl: "/tiny-ui-sw.js" })` during your app bootstrap.

### 2. Register a virtual project snapshot

Load the plugin source tree (for example, from OPFS) and cache it with Tiny UI. The compile step reads this snapshot when it builds the bundle.

```ts
import { loadSnapshot, compile, setLockfile } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

setLockfile({
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
});

const source = {
  id: "weather-ui",
  root: "/plugins/weather-ui",
  entrypoint: "/index.tsx",
};

await loadSnapshot(source.root, source.entrypoint);
registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);

const result = await compile(source.id, {
  wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
});

console.log(result.hash, result.url, result.assets);
```

### 3. Render the React wrapper

```tsx
import { setupTinyUI, TinyUI } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";
import runtimeUrl from "@pstdio/tiny-ui/dist/runtime.html?url";
import serviceWorkerUrl from "@pstdio/tiny-ui-bundler/dist/sw.js?url";

const hostApi = {
  "actions.log": (params?: Record<string, unknown>) => {
    console.log("[weather-ui]", params?.message ?? "<no message>");
    return { ok: true };
  },
};

registerSources([{ id: "weather-ui", root: "/plugins/weather-ui" }]);
void setupTinyUI({ runtimeUrl, serviceWorkerUrl }).catch(console.error);

function PluginFrame() {
  return (
    <TinyUI
      instanceId="weather-ui-runtime"
      sourceId="weather-ui"
      autoCompile
      onStatusChange={(status) => console.log("Tiny UI status", status)}
      onError={(error) => console.error(error)}
      onActionCall={(method, params) => {
        const handler = hostApi[method as keyof typeof hostApi];
        if (!handler) {
          throw new Error(`Unhandled Tiny UI host method: ${method}`);
        }
        return handler(params as Record<string, unknown> | undefined);
      }}
    />
  );
}
```

- `instanceId` uniquely identifies the iframe host session.
- `sourceId` must match the ID you registered via `registerSources` when seeding the snapshot.
- `onActionCall` is the single entrypoint for routing `remote.ops` requests to your application API.

### 4. Handle `remote.ops` requests

Plugins invoke `remote.ops` (for example through `host.actions.*`) whenever they need something from the host. `TinyUI` surfaces each of those calls through `onActionCall(method, params)`. Route the call to your own application API, return a result (or throw to reject), and you're done.

---

## API Reference

### Bootstrap

- **`setupTinyUI(options)`** – configure Tiny UI once per page (registers the service worker, sets the runtime URL, and primes global state).
- **`setupServiceWorker(options)`** – lower-level helper to register only the service worker.
- **`getTinyUIRuntimePath()`** – current runtime iframe URL resolved from `setupTinyUI`.

### Core Components

- **`TinyUI(props)`** – React component that compiles snapshots and boots the runtime iframe. Accepts lifecycle callbacks, `autoCompile`, and an `onActionCall` handler for host RPCs.
- **`TinyUIStatus`** – status union (`"initializing" | "idle" | "compiling" | "ready" | "error"`).

### Snapshot Management

- **`registerVirtualSnapshot(root, snapshot)`** / **`unregisterVirtualSnapshot(root)`** – cache the in-memory file tree Tiny UI will compile.
- **`loadSnapshot(root, entry)`** – read OPFS into a snapshot and register it for compilation.

### Build & Compilation

- **`compile(id, options)`** – compile a registered snapshot using esbuild-wasm and cache the result.
- **`getCachedBundle(id)`** – retrieve a previously compiled bundle from cache.

### Lockfile & Import Maps

- **`setLockfile(lockfile)`** / **`getLockfile()`** – manage remote module metadata.
- **`buildImportMap(lockfile)`** – convert a lockfile into an import map for the runtime iframe.

### Low-Level Host Integration

- **`createTinyHost(iframe, id)`** – low-level host connector exposing `sendInit`, `onReady`, `onError`, `onOps`, and `disconnect`.

### Constants

- **`CACHE_NAME`**, **`RUNTIME_HTML_PATH`**, **`VIRTUAL_PREFIX`** – constants that mirror the service worker config.

---

## Examples

### Load OPFS files once, reuse across reloads

```ts
import { loadSnapshot, TinyUI, CACHE_NAME, setupTinyUI } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

async function bootPlugin() {
  void setupTinyUI({ runtimeUrl: "/tiny-ui/runtime.html", serviceWorkerUrl: "/tiny-ui-sw.js" }).catch(
    console.error,
  );

  await loadSnapshot("plugins/notepad", "/index.tsx");
  registerSources([{ id: "notepad", root: "/plugins/notepad" }]);

  render(
    <TinyUI
      instanceId="notepad-host"
      sourceId="notepad"
      onActionCall={(method, params) => {
        console.log("Unhandled request", method, params);
        return { ok: true };
      }}
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
import { compile, createTinyHost, getCachedBundle, loadSnapshot } from "@pstdio/tiny-ui";
import { registerSources } from "@pstdio/tiny-ui-bundler";

const pluginId = "sql-explorer";
const iframe = document.querySelector("iframe#plugin")!;
const host = await createTinyHost(iframe, pluginId);

const hostApi = {
  "actions.log": (params?: Record<string, unknown>) => {
    console.log("[sql-explorer]", params?.message ?? "<no message>");
    return { ok: true };
  },
};

host.onOps(async ({ method, params }) => {
  const handler = hostApi[method as keyof typeof hostApi];
  if (!handler) throw new Error(`Unhandled Tiny UI host method: ${method}`);
  return handler(params as Record<string, unknown> | undefined);
});

let result = await getCachedBundle(pluginId);

if (!result) {
  const source = {
    id: pluginId,
    root: "/plugins/sql-explorer",
    entrypoint: "/index.tsx",
  };

  await loadSnapshot(source.root, source.entrypoint);
  registerSources([{ id: source.id, root: source.root, entry: source.entrypoint }]);

  result = await compile(pluginId, {
    wasmURL: "https://unpkg.com/esbuild-wasm@0.25.10/esbuild.wasm",
  });
}

await host.sendInit(result);
```

---

## Usage Notes

- The first compile downloads `esbuild-wasm` (≈1 MB); host environments can pass a custom `runtimeUrl` via `setupTinyUI({ runtimeUrl })` or override `wasmURL` to point at a local mirror.
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
